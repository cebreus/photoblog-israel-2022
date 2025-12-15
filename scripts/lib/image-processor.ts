import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exiftool } from "exiftool-vendored";
import type { ImageEntry, ImageSource, QualityTypes } from "../../src/lib/types/manifest";
import type { ExifData as ManifestExifData } from "../../src/lib/types/manifest";
import { ImageFormat } from "../../src/lib/types/images";
import { config } from "../config";
import { createLogger } from "./logger";
import { aiService } from "./ai-models";
import {
  getAltText,
  getAspectRatioName,
  getKeywords,
  normalizeText,
  ensureDir,
  calculateSharpness,
  calculatePhash,
} from "./image-utils";
import { toSlug } from "../../src/lib/utils/strings";
import { execSync } from "node:child_process";
import os from "node:os";
import { METADATA_STANDARDS } from "../../src/lib/metadata-standards";
// xxhash-wasm types might be missing
import xxhash from "xxhash-wasm";
import { detectFaces, type FaceBox } from "./face-detection";
import { calculateSmartCrop } from "./smart-crop";

let xxhashModule: any = null;
async function getXxhash() {
  if (!xxhashModule) {
    xxhashModule = await (xxhash as any)();
  }
  return xxhashModule;
}

const logger = createLogger("images");

type SharpModule = typeof import("sharp");
type OutputConfig = (typeof config.outputs)[keyof typeof config.outputs];

type OutputDefinition = {
  key: keyof typeof config.outputs;
  mode: "variant" | "other";
  config: OutputConfig;
  isPlaceholder: boolean;
};

type VariantOutputConfig = Extract<OutputConfig, { kind: "variant" }>;
type OtherOutputConfig = Extract<OutputConfig, { kind: "other" }>;

interface RawExifData extends ManifestExifData {
  ObjectName?: string;
  Headline?: string;
  Title?: string;
  "dc:title"?: string;
  ImageDescription?: string;
  Caption?: string;
  CaptionAbstract?: string;
  Byline?: string;
  "dc:creator"?: string | string[];
  Creator?: string;
  BylineTitle?: string;
  Artist?: string;
  Author?: string;
  Sublocation?: string;
  Orientation?: number | string; // ExifTool returns string/number
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  Location?: string;
  City?: string;
  Copyright?: string;
  CopyrightNotice?: string;
  Category?: string;
  CategoryCode?: string;
  Country?: string;
  CountryCode?: string;
  State?: string;
  latitude?: number;
  longitude?: number;
}

interface ResizeConfig {
  width?: number;
  height?: number;
  crop?: boolean;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export type ProcessedImageResult = {
  key: string;
  hash: string;
  mtimeMs: number;
  bytes: number;
  outputs: string[];
  image: ImageEntry;
};

export type ImageProcessOptions = {
  manifestOnly: boolean;
  curation: boolean;
  srcRoot: string;
  outRoot: string;
  allowUpscale: boolean;
  formats: ImageFormat[];
  qualityOverrides: Partial<Record<QualityTypes, number>>;
  previousEntry?: ImageEntry;
  oldHash?: string;
};

let sharp: SharpModule | null = null;

export async function loadSharpOrExplain(): Promise<void> {
  if (sharp) return;
  try {
    const mod: any = await import("sharp");
    sharp = mod.default ?? mod;
  } catch (err: unknown) {
    logger.error("Failed to load sharp. Did you run bun install?", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

export function requireSharp(): SharpModule {
  if (!sharp) {
    throw new Error("Sharp instance not loaded");
  }
  return sharp;
}

export async function cleanup(): Promise<void> {
  await exiftool.end();
}

function ignoreError(_err?: unknown): void {
  // Intentionally empty
}

export function buildOutputDefinitions(): OutputDefinition[] {
  return Object.entries(config.outputs).map(([k, value]) => {
    const isOther = value.kind === "other";
    return {
      key: k as keyof typeof config.outputs,
      mode: value.kind,
      config: value,
      // isPlaceholder only exists for other outputs
      isPlaceholder: isOther && Boolean((value as any).isPlaceholder),
    };
  });
}

export async function processImage(
  absPath: string,
  options: ImageProcessOptions,
): Promise<ProcessedImageResult | null> {
  await loadSharpOrExplain();
  const sharpModule = requireSharp();
  const key = path.posix.normalize(path.relative(options.srcRoot, absPath));
  const baseName = path.basename(absPath, path.extname(absPath));

  // Declare tempFilePath and processingPath outside the try so they are visible in catch
  let processingPath = absPath;
  let tempFilePath: string | null = null;

  try {
    const stats = await fsp.stat(absPath);

    // Use xxhash for much faster non-cryptographic hashing
    const { create64 } = await getXxhash();
    const hasher = create64();
    const stream = fs.createReadStream(absPath);
    for await (const chunk of stream) {
      hasher.update(chunk);
    }
    const fileHash = hasher.digest().toString(16);

    const ext = path.extname(absPath).slice(1).toLowerCase();

    if (ext === "heic" || ext === "heif") {
      const tmpDir = os.tmpdir();
      tempFilePath = path.join(tmpDir, `${baseName}_converted.jpg`);
      try {
        execSync(`vips copy "${absPath}" "${tempFilePath}"`);
        processingPath = tempFilePath;
      } catch (convErr) {
        logger.warn(`Failed to convert HEIC via vips for ${absPath}: ${convErr}`);
      }
    }

    const sharpInstance = sharpModule(processingPath);

    // Use exiftool to read metadata (it's robust for HEIC/XMP)
    // We run it on the ORIGINAL file (absPath), not the converted JPG, to get full original metadata
    // OPTIMIZATION: Hash-based Reuse & Dev Mode Skip
    // --------------------------------------------------------------------------------
    let shouldAnalyze = !options.manifestOnly || options.curation;
    let reusedAnalysis: Partial<ImageEntry["analysis"]> = {};
    let reusedExif: Partial<ImageEntry["exif"]> = {};
    let reusedOther: Partial<ImageEntry> = {};

    if (options.previousEntry && options.oldHash && fileHash === options.oldHash) {
      // CONTENT UNCHANGED -> Reuse expensive data
      logger.verbose(`Hash match for ${key}, reusing analysis data.`);

      const prev = options.previousEntry;

      // Reuse analysis (Sharpness, Phash, Embedding)
      reusedAnalysis = {
        sharpness: prev.analysis?.sharpness,
        phash: prev.analysis?.phash,
        embedding: prev.analysis?.embedding,
      };

      // Reuse extracted EXIF related fields that might be expensive to re-normalize (though fast)
      // Actually we can reuse the whole "exif" object block from manifest safely via Object.assign later
      reusedExif = prev.exif || {};

      // Reuse base properties
      reusedOther = {
        placeholderColor: prev.placeholderColor,
        // We generally reconstruct title/caption traversing current standard, but reusing is also fine?
        // Let's stick to reusing analysis primarily, as that's the slow part.
      };

      // If we reuse analysis, we skip recalculating it
      // BUT if the reused analysis is empty (e.g. from a previous fast dev run) and we NEED analysis now (e.g. curation),
      // then we must re-calculate.
      const isAnalysisValid =
        typeof reusedAnalysis.sharpness === "number" && reusedAnalysis.sharpness > 0;

      if (shouldAnalyze && !isAnalysisValid) {
        logger.verbose(`Hash match for ${key}, but previous analysis was skipped. Re-analyzing.`);
        // Force re-analysis
      } else {
        shouldAnalyze = false;
      }
    }

    // --------------------------------------------------------------------------------

    const [imageStats, exifTags, originalMeta, sharpnessScore, phash] = await Promise.all([
      // Stats: needed for dominant color (placeholder). Reuse if matched.
      shouldAnalyze ? sharpInstance.stats() : Promise.resolve(null),

      // Exif: always fast, keeps metadata fresh even if content is same (e.g. if we want to re-parse different fields)
      // BUT if hash matched, file content is identical including EXIF!
      // So technically we COULD reuse EXIF too. But EXIF is fast.
      // Let's keep reading EXIF to ensure any code changes in "how we read metadata" apply immediately.
      exiftool.read(absPath),

      // Metadata: needed for dimensions. Always read. Fast.
      sharpInstance.metadata(),

      // Sharpness: SLOW. Reuse or Skip.
      shouldAnalyze
        ? calculateSharpness(sharpModule, processingPath)
        : Promise.resolve(reusedAnalysis.sharpness ?? 0),

      // Phash: SLOW. Reuse or Skip.
      shouldAnalyze
        ? calculatePhash(sharpModule, processingPath)
        : Promise.resolve(reusedAnalysis.phash ?? ""),
    ]);

    // OPTIMIZATION: Date Filter for debugging
    // If FILTER_DATE is set (YYYY-MM-DD), skip if doesn't match.
    if (process.env.FILTER_DATE) {
      let dateStr = "";
      const dto = exifTags.DateTimeOriginal;
      if (dto instanceof Date) {
        dateStr = dto.toISOString().split("T")[0];
      } else if (typeof dto === "string") {
        // ExifTool string format: YYYY:MM:DD HH:MM:SS
        // or ISO
        const parts = dto.split(" ")[0].replace(/:/g, "-");
        dateStr = parts;
      } else if (dto && (dto as any).year) {
        // ExifDate object?
        dateStr = `${(dto as any).year}-${String((dto as any).month).padStart(2, "0")}-${String((dto as any).day).padStart(2, "0")}`;
      }

      if (dateStr !== process.env.FILTER_DATE) {
        // logger.info(`Skipping ${baseName} (Date: ${dateStr})`);
        return null;
      }
    }

    let embedding: number[] | undefined = reusedAnalysis.embedding;
    if (shouldAnalyze && options.curation) {
      embedding = await aiService.generateEmbedding(processingPath);
    }

    // We access properties using keys defined in our shared Metadata Standards
    // const { METADATA_STANDARDS } = await import("../../src/lib/metadata-standards");

    function getStandardValue(key: keyof typeof METADATA_STANDARDS): string | undefined {
      const config = METADATA_STANDARDS[key];
      for (const tag of config.read) {
        // Check exact match first
        const val = (exifTags as any)[tag];
        // Handle array values (like keywords or creators) - take first or join?
        // Metadata standards imply single canonical string values mostly, except keywords.
        // But for extraction, we prefer string unless keyword.
        if (val !== undefined && val !== null && val !== "") {
          if (Array.isArray(val)) {
            return val[0]; // Take first item if array (e.g. Creator array)
          }
          return String(val);
        }
      }
      return undefined;
    }

    function getKeywordsList(): string[] | undefined {
      const config = METADATA_STANDARDS.keywords;
      for (const tag of config.read) {
        const val = (exifTags as any)[tag];
        if (val) {
          if (Array.isArray(val)) return val;
          return [String(val)];
        }
      }
      return undefined;
    }

    // We populate specific fields needed by createImageEntry, plus the canonical ones
    const exifRaw: Partial<RawExifData> = {
      // Historical mappings for components depending on them
      ObjectName: exifTags.ObjectName,
      Headline: exifTags.Headline,
      Title: getStandardValue("title"), // Use standard (prefers XMP)
      "dc:title": exifTags.Title,
      ImageDescription: exifTags.ImageDescription || exifTags.Description,
      Caption: getStandardValue("caption"), // Use standard
      CaptionAbstract: exifTags["Caption-Abstract"],
      Byline: exifTags["By-line"],
      "dc:creator": exifTags.Creator,
      Creator: getStandardValue("author"), // Use standard
      BylineTitle: exifTags["By-lineTitle"],
      Artist: exifTags.Artist,
      Author: getStandardValue("author"),
      Sublocation: exifTags["Sub-location"] as string,
      Orientation: exifTags.Orientation,
      DateTimeOriginal:
        typeof exifTags.DateTimeOriginal === "object"
          ? exifTags.DateTimeOriginal.toDate()
          : (exifTags.DateTimeOriginal as any),
      CreateDate:
        typeof exifTags.CreateDate === "object"
          ? exifTags.CreateDate.toDate()
          : (exifTags.CreateDate as any),
      Location: getStandardValue("location"),
      City: getStandardValue("city"),
      Country: getStandardValue("country"),
      CountryCode: getStandardValue("countryCode"),
      State: getStandardValue("state"),
      Copyright: exifTags.Copyright,
      CopyrightNotice: exifTags.CopyrightNotice,
      Category: exifTags.Category,
      latitude: Number(exifTags.GPSLatitude) || undefined,
      longitude: Number(exifTags.GPSLongitude) || undefined,
      // Keywords are special as array
      // But RawExifData doesn't seem to have keywords property explicitly typed?
      // Checking interface: RawExifData extends ManifestExifData.
      // ManifestExifData has keywords?: string[].
    };

    // Assign keywords manually as the interface might expect it
    // Wait, RawExifData definition in this file (lines 41-70) does NOT have keywords.
    // But it extends ManifestExifData which DOES (line 11 says `type ExifData as ManifestExifData`).
    // Let's verify src/lib/types/manifest.ts content?
    // Assuming ManifestExifData has it.
    (exifRaw as any).keywords = getKeywordsList();

    const dominant = imageStats?.dominant || { r: 0, g: 0, b: 0 };
    const placeholderColor =
      reusedOther.placeholderColor || `rgb(${dominant.r},${dominant.g},${dominant.b})`;

    // Detect faces for smart cropping
    let faces: FaceBox[] = [];
    if (!options.manifestOnly) {
      try {
        const detectWidth = 800;
        // Resize for faster detection
        const buffer = await sharpModule(processingPath)
          .resize({ width: detectWidth, withoutEnlargement: true })
          .toBuffer();

        const detected = await detectFaces(buffer);

        // Scale boxes back to original dimensions
        // We need the dimensions of the resized image to calculate scale
        const resizedMeta = await sharpModule(buffer).metadata();
        const scale = (originalMeta.width || 1) / (resizedMeta.width || 1);

        faces = detected.map((b) => ({
          x: b.x * scale,
          y: b.y * scale,
          width: b.width * scale,
          height: b.height * scale,
        }));

        if (faces.length > 0) {
          logger.verbose(`Detected ${faces.length} faces in ${key}`);
        }
      } catch (e) {
        logger.warn(`Face detection failed for ${key}: ${e}`);
        // Continue without faces
      }
    }

    const outputs: string[] = [];
    const sources: ImageSource[] = [];

    const sizeMB = Number((stats.size / 1024 / 1024).toFixed(2));

    const imageEntry = await createImageEntry(
      baseName,
      absPath,
      exifRaw,
      originalMeta,
      placeholderColor,
      sharpnessScore,
      phash,
      embedding,
      sizeMB,
    );

    const outputDefinitions = buildOutputDefinitions();

    for (const output of outputDefinitions) {
      if (output.mode === "variant") {
        const variantConfig = output.config as VariantOutputConfig;
        for (const format of options.formats) {
          const { outPath, info } = await generateVariant(
            sharpModule,
            processingPath,
            baseName,
            variantConfig,
            format,
            options,
            originalMeta,
            faces,
            output.key,
          );
          outputs.push(outPath);
          sources.push({
            variant: output.key,
            type: `image/${format}`,
            path: `${config.paths.urlPrefix}/images/${outPath}`,
            width: variantConfig.resize?.width ?? info.width,
            height: undefined,
          });
        }
      } else {
        const otherConfig = output.config as OtherOutputConfig;
        const { outPath, info } = await generateOtherOutput(
          sharpModule,
          processingPath,
          baseName,
          otherConfig,
          options,
          originalMeta,
        );
        outputs.push(outPath);
        if (output.isPlaceholder) {
          imageEntry.placeholder = outPath;
        } else {
          const format = "format" in otherConfig ? otherConfig.format : ImageFormat.JPEG;
          sources.push({
            variant: output.key,
            type: `image/${format}`,
            path: `${config.paths.urlPrefix}/images/${outPath}`,
            width: info.width,
            height: info.height,
          });
        }
      }
    }

    imageEntry.sources = sources;

    return {
      key,
      hash: fileHash,
      mtimeMs: stats.mtimeMs,
      bytes: stats.size,
      outputs,
      image: imageEntry,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.stack || e.message : String(e);
    logger.error(`Failed to process ${key}: ${msg}`);
    return null;
  } finally {
    // Clean up temporary file if it was created
    if (tempFilePath) {
      try {
        await fsp.unlink(tempFilePath);
      } catch (_) {}
    }
  }
}

export async function createImageEntry(
  baseName: string,
  absPath: string,
  exif: Partial<RawExifData>,
  originalMeta: import("sharp").Metadata,
  placeholderColor: string,
  sharpness?: number,
  phash?: string,
  embedding?: number[],
  sizeMB?: number,
): Promise<ImageEntry> {
  const titleCanonical = normalizeText(
    exif.ObjectName || exif.Headline || exif.Title || exif["dc:title"] || exif.ImageDescription,
  );
  const captionCanonical = normalizeText(
    exif.Caption || exif.CaptionAbstract || exif.ImageDescription,
  );
  const authorCanonical = normalizeText(
    exif.Byline ||
      (Array.isArray(exif["dc:creator"]) ? exif["dc:creator"][0] : exif["dc:creator"]) ||
      exif.Creator ||
      exif.BylineTitle ||
      exif.Artist ||
      exif.Author,
  );

  // Normalize orientation to what manifest expects (string usually in this project)
  // But ExifTool might return number or string.
  // We'll leave it as is if it's compatible or just toString() it?
  // Current project seems to use "Horizontal (normal)" strings from ExifTool

  // Safe date parsing
  let isoDate: string | undefined;
  try {
    const d = exif.DateTimeOriginal || exif.CreateDate;
    if (d instanceof Date) {
      isoDate = d.toISOString();
    } else if (typeof d === "string") {
      isoDate = new Date(d).toISOString();
    }
  } catch (e) {
    // ignore invalid date
  }

  // Map URLs
  const googleMapsUrl =
    exif.latitude && exif.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${exif.latitude},${exif.longitude}`
      : undefined;

  return {
    id: "img-" + toSlug(baseName),
    type: "image",
    src: path.basename(absPath),
    alt: getAltText(exif, captionCanonical, titleCanonical),
    title: titleCanonical || "",
    caption: captionCanonical,
    width: originalMeta.width,
    height: originalMeta.height,
    sizeMB,
    aspectRatio:
      originalMeta.width && originalMeta.height
        ? getAspectRatioName(originalMeta.width, originalMeta.height)
        : undefined,
    placeholder: undefined,
    placeholderColor,
    analysis: {
      sharpness: sharpness || 0,
      phash: phash || "",
      embedding: embedding || [],
    },
    exif: {
      date: isoDate,
      location: exif.Location,
      city: exif.City,
      title: exif.Title || exif.ObjectName, // Expose raw title
      sublocation: exif.Sublocation,
      latitude: exif.latitude,
      longitude: exif.longitude,
      orientation: exif.Orientation as any, // Cast as it might be varied
      description: normalizeText(exif.ImageDescription || undefined),
      keywords: getKeywords(exif),
      author: authorCanonical,
      copyright: normalizeText(exif.Copyright || exif.CopyrightNotice),
      category: normalizeText(exif.Category || exif.CategoryCode),
      country: exif.Country,
      countryCode: exif.CountryCode,
      state: exif.State,
    },
    author: authorCanonical,
    authorSlug: authorCanonical ? toSlug(authorCanonical) : undefined,
    keywords: getKeywords(exif),
    location: exif.Sublocation || exif.Location,
    city: exif.City, // Top-level city for frontend convenience
    googleMapsUrl,
    date: isoDate,
    sources: [],
  };
}

function applyFormat(instance: ReturnType<SharpModule>, format: ImageFormat, quality: number) {
  if (format === ImageFormat.JPEG) instance.jpeg({ quality, ...config.encoding.sharp.jpeg });
  else if (format === ImageFormat.WEBP) instance.webp({ quality, ...config.encoding.sharp.webp });
  else if (format === ImageFormat.AVIF) instance.avif({ quality, ...config.encoding.sharp.avif });
}

function getQuality(
  format: ImageFormat,
  qualityOverrides: Partial<Record<QualityTypes, number>>,
): number {
  const qualityKey = format === ImageFormat.PNG ? ImageFormat.JPEG : format;
  return qualityOverrides[qualityKey] ?? config.encoding.quality[qualityKey];
}

function buildSharpInstance(
  sharpModule: SharpModule,
  input: Buffer | string,
  resizeConfig: ResizeConfig,
  allowUpscale: boolean,
) {
  const resizeSpec: import("sharp").ResizeOptions = { ...resizeConfig };
  if (resizeConfig.crop) {
    resizeSpec.fit = "cover";
  }
  if (!allowUpscale) {
    resizeSpec.withoutEnlargement = true;
  }
  return sharpModule(input).resize(resizeSpec);
}

async function generateVariant(
  sharpModule: SharpModule,
  input: Buffer | string,
  baseName: string,
  variantConfig: VariantOutputConfig,
  format: ImageFormat,
  options: ImageProcessOptions,
  originalMeta: import("sharp").Metadata,
  faces: FaceBox[] = [],
  variantKey?: string,
) {
  const outExt = format === "jpeg" ? "jpeg" : format;
  const variantFolder =
    format === ImageFormat.JPEG
      ? variantConfig.folderName
      : `${variantConfig.folderName}-${format}`;
  const outPath = path.posix.normalize(path.join(variantFolder, `${baseName}.${outExt}`));

  let info: import("sharp").OutputInfo;

  if (options.manifestOnly) {
    const dims = calculateOutputDimensions(
      originalMeta.width ?? 0,
      originalMeta.height ?? 0,
      variantConfig.resize || {},
      options.allowUpscale,
    );
    info = {
      format: format,
      size: 0,
      width: dims.width,
      height: dims.height,
      channels: 3,
      premultiplied: false,
    };
  } else {
    const allowSmartCrop =
      faces.length > 0 &&
      variantConfig.resize?.crop &&
      ["default", "xl", "fallback"].includes(variantKey || "");

    let cropRect = null;
    if (allowSmartCrop) {
      cropRect = calculateSmartCrop(
        originalMeta.width ?? 0,
        originalMeta.height ?? 0,
        faces,
        variantConfig.resize!.width!,
        variantConfig.resize!.height!,
      );
    }

    let resizedInstance: import("sharp").Sharp;

    if (cropRect) {
      resizedInstance = sharpModule(input)
        .extract({
          left: Math.round(cropRect.left),
          top: Math.round(cropRect.top),
          width: Math.round(cropRect.width),
          height: Math.round(cropRect.height),
        })
        .resize({
          width: variantConfig.resize!.width,
          height: variantConfig.resize!.height,
          // We already cropped to aspect ratio, so just resize logic is fine.
          // Sharp default fit is cover, but we provide exact AR match usually.
        });
    } else {
      resizedInstance = buildSharpInstance(
        sharpModule,
        input,
        variantConfig.resize,
        options.allowUpscale,
      );
    }

    const quality = getQuality(format, options.qualityOverrides);
    applyFormat(resizedInstance, format, quality);

    const fullOutPath = path.join(options.outRoot, outPath);
    await ensureDir(path.dirname(fullOutPath));
    info = await resizedInstance.toFile(fullOutPath);
  }

  return { outPath, info };
}

async function generateOtherOutput(
  sharpModule: SharpModule,
  input: Buffer | string,
  baseName: string,
  outputConfig: OtherOutputConfig,
  options: ImageProcessOptions,
  originalMeta: import("sharp").Metadata,
) {
  const format = "format" in outputConfig ? outputConfig.format : ImageFormat.JPEG;
  const outExt = format === "jpeg" ? "jpeg" : format;
  const outPath = path.posix.normalize(path.join(outputConfig.folderName, `${baseName}.${outExt}`));

  let info: import("sharp").OutputInfo;

  if (options.manifestOnly) {
    const dims = calculateOutputDimensions(
      originalMeta.width ?? 0,
      originalMeta.height ?? 0,
      outputConfig.resize || {},
      options.allowUpscale,
    );
    info = {
      format: format,
      size: 0,
      width: dims.width,
      height: dims.height,
      channels: 3,
      premultiplied: false,
    };
  } else {
    const resizedInstance = buildSharpInstance(
      sharpModule,
      input,
      outputConfig.resize || {},
      options.allowUpscale,
    );

    if ("blur" in outputConfig && outputConfig.blur) {
      resizedInstance.blur(10).png(config.encoding.sharp.blur.png);
    } else {
      const quality = getQuality(format, options.qualityOverrides);
      applyFormat(resizedInstance, format, quality);
    }

    const fullOutPath = path.join(options.outRoot, outPath);
    await ensureDir(path.dirname(fullOutPath));
    info = await resizedInstance.toFile(fullOutPath);
  }

  return { outPath, info };
}

function calculateOutputDimensions(
  srcW: number,
  srcH: number,
  resize: ResizeConfig,
  allowUpscale: boolean,
): { width: number; height: number } {
  if (!srcW || !srcH) return { width: 0, height: 0 };

  let targetW = resize.width;
  let targetH = resize.height;
  const fit = resize.crop ? "cover" : resize.fit || "cover";

  if (!targetW && !targetH) return { width: srcW, height: srcH };

  if (!targetH && targetW) {
    targetH = Math.round(srcH * (targetW / srcW));
  } else if (!targetW && targetH) {
    targetW = Math.round(srcW * (targetH / srcH));
  }

  if (!targetW) targetW = srcW;
  if (!targetH) targetH = srcH;

  if (!allowUpscale) {
    if (targetW > srcW || targetH > srcH) {
      if (fit === "inside" || fit === "contain") {
        const scale = Math.min(1, Math.min(targetW / srcW, targetH / srcH));
        targetW = Math.round(srcW * scale);
        targetH = Math.round(srcH * scale);
      } else if (fit === "cover" || fit === "fill") {
        if (targetW > srcW && targetH > srcH) {
          targetW = srcW;
          targetH = srcH;
        }
      }
    }
  }

  return { width: targetW, height: targetH };
}

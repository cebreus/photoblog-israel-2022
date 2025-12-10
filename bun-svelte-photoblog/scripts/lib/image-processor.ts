import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exiftool } from "exiftool-vendored";
import type {
  ImageEntry,
  ImageSource,
  QualityTypes,
} from "../../src/lib/types/manifest";
import type { ExifData as ManifestExifData } from "../../src/lib/types/manifest";
import { ImageFormat } from "../../src/lib/types/images";
import { config } from "../config";
import { createLogger } from "./logger";
import {
  getAltText,
  getAspectRatioName,
  getKeywords,
  normalizeText,
  ensureDir,
} from "./image-utils";
import { toSlug } from "../../src/lib/utils/strings";
import { execSync } from "node:child_process";
import os from "node:os";

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
  srcRoot: string;
  outRoot: string;
  hasGifCopy: boolean;
  allowUpscale: boolean;
  formats: ImageFormat[];
  qualityOverrides: Partial<Record<QualityTypes, number>>;
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
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(absPath);
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    const fileHash = hash.digest("hex");

    const ext = path.extname(absPath).slice(1).toLowerCase();

    if (ext === "gif" && options.hasGifCopy) {
      const buffer = await fsp.readFile(absPath);
      return await copyGif(absPath, buffer, stats, fileHash, options);
    }

    if (ext === "heic" || ext === "heif") {
      const tmpDir = os.tmpdir();
      tempFilePath = path.join(tmpDir, `${baseName}_converted.jpg`);
      try {
        execSync(`vips copy "${absPath}" "${tempFilePath}"`);
        processingPath = tempFilePath;
      } catch (convErr) {
        logger.warn(
          `Failed to convert HEIC via vips for ${absPath}: ${convErr}`,
        );
      }
    }

    const sharpInstance = sharpModule(processingPath);

    // Use exiftool to read metadata (it's robust for HEIC/XMP)
    // We run it on the ORIGINAL file (absPath), not the converted JPG, to get full original metadata
    const [imageStats, exifTags, originalMeta] = await Promise.all([
      sharpInstance.stats(),
      exiftool.read(absPath),
      sharpInstance.metadata(),
    ]);

    // Map ExifTool tags to our RawExifData structure
    // We access properties using bracket notation for keys that contain hyphens or are strictly typed in Tags
    const exifRaw: Partial<RawExifData> = {
      ObjectName: exifTags.ObjectName,
      Headline: exifTags.Headline,
      Title: exifTags.Title,
      "dc:title": exifTags.Title,
      ImageDescription: exifTags.ImageDescription || exifTags.Description,
      Caption: exifTags.Description || exifTags["Caption-Abstract"],
      CaptionAbstract: exifTags["Caption-Abstract"],
      Byline: exifTags["By-line"],
      "dc:creator": exifTags.Creator,
      Creator: exifTags.Creator,
      BylineTitle: exifTags["By-lineTitle"],
      Artist: exifTags.Artist,
      Author: exifTags.Author,
      Sublocation: exifTags["Sub-location"] as string,
      Orientation: exifTags.Orientation, // ExifTool returns string/number
      DateTimeOriginal:
        typeof exifTags.DateTimeOriginal === "object"
          ? exifTags.DateTimeOriginal.toDate()
          : (exifTags.DateTimeOriginal as any),
      CreateDate:
        typeof exifTags.CreateDate === "object"
          ? exifTags.CreateDate.toDate()
          : (exifTags.CreateDate as any),
      Location: exifTags.Location || (exifTags["Sub-location"] as string),
      City: exifTags.City,
      Country: exifTags.Country || exifTags["Country-PrimaryLocationName"],
      CountryCode:
        (exifTags["Country-PrimaryLocationCode"] as string) ||
        exifTags.CountryCode,
      State: exifTags["Province-State"] || exifTags.State,
      Copyright: exifTags.Copyright,
      CopyrightNotice: exifTags.CopyrightNotice,
      Category: exifTags.Category,
      latitude: Number(exifTags.GPSLatitude) || undefined,
      longitude: Number(exifTags.GPSLongitude) || undefined,
    };

    const dominant = imageStats?.dominant || { r: 0, g: 0, b: 0 };
    const placeholderColor = `rgb(${dominant.r},${dominant.g},${dominant.b})`;

    const outputs: string[] = [];
    const sources: ImageSource[] = [];

    const imageEntry = await createImageEntry(
      baseName,
      absPath,
      exifRaw,
      originalMeta,
      placeholderColor,
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
          const format =
            "format" in otherConfig ? otherConfig.format : ImageFormat.JPEG;
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
): Promise<ImageEntry> {
  const titleCanonical = normalizeText(
    exif.ObjectName ||
      exif.Headline ||
      exif.Title ||
      exif["dc:title"] ||
      exif.ImageDescription,
  );
  const captionCanonical = normalizeText(
    exif.Caption || exif.CaptionAbstract || exif.ImageDescription,
  );
  const authorCanonical = normalizeText(
    exif.Byline ||
      (Array.isArray(exif["dc:creator"])
        ? exif["dc:creator"][0]
        : exif["dc:creator"]) ||
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

  const mapyCzUrl =
    exif.latitude && exif.longitude
      ? `https://mapy.cz/zakladni?x=${exif.longitude}&y=${exif.latitude}&z=12`
      : undefined;

  return {
    id: "img-" + toSlug(baseName),
    type: "image",
    src: path.basename(absPath),
    alt: getAltText(exif, captionCanonical, titleCanonical),
    title:
      [exif.Sublocation, exif.Location, exif.City, exif.Title]
        .filter(Boolean)
        .join(", ") ||
      titleCanonical ||
      "",
    caption: captionCanonical,
    width: originalMeta.width,
    height: originalMeta.height,
    aspectRatio:
      originalMeta.width && originalMeta.height
        ? getAspectRatioName(originalMeta.width, originalMeta.height)
        : undefined,
    placeholder: undefined,
    placeholderColor,
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
    location: exif.Sublocation || exif.Location,
    city: exif.City, // Top-level city for frontend convenience
    googleMapsUrl,
    mapyCzUrl,
    date: isoDate,
    sources: [],
  };
}

function applyFormat(
  instance: ReturnType<SharpModule>,
  format: ImageFormat,
  quality: number,
) {
  if (format === ImageFormat.JPEG)
    instance.jpeg({ quality, ...config.encoding.sharp.jpeg });
  else if (format === ImageFormat.WEBP)
    instance.webp({ quality, ...config.encoding.sharp.webp });
  else if (format === ImageFormat.AVIF)
    instance.avif({ quality, ...config.encoding.sharp.avif });
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
) {
  const outExt = format === "jpeg" ? "jpeg" : format;
  const variantFolder =
    format === ImageFormat.JPEG
      ? variantConfig.folderName
      : `${variantConfig.folderName}-${format}`;
  const outPath = path.posix.normalize(
    path.join(variantFolder, `${baseName}.${outExt}`),
  );

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
    const resizedInstance = buildSharpInstance(
      sharpModule,
      input,
      variantConfig.resize,
      options.allowUpscale,
    );

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
  const format =
    "format" in outputConfig ? outputConfig.format : ImageFormat.JPEG;
  const outExt = format === "jpeg" ? "jpeg" : format;
  const outPath = path.posix.normalize(
    path.join(outputConfig.folderName, `${baseName}.${outExt}`),
  );

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

async function copyGif(
  absPath: string,
  fileBuffer: Buffer,
  stats: import("fs").Stats,
  fileHash: string,
  options: ImageProcessOptions,
): Promise<ProcessedImageResult> {
  const { srcRoot, outRoot, manifestOnly } = options;
  const key = path.posix.normalize(path.relative(srcRoot, absPath));
  const baseName = path.basename(absPath, path.extname(absPath));

  const outputs: string[] = [];
  const sources: ImageSource[] = [];

  const outputDefinitions = buildOutputDefinitions();

  await loadSharpOrExplain();
  const sharpModule = requireSharp();
  const meta = await sharpModule(fileBuffer).metadata().catch(ignoreError);
  const knownWidth = meta?.width;
  const knownHeight = meta?.height;

  for (const output of outputDefinitions) {
    if (output.mode !== "variant") continue;

    const outPath = path.posix.normalize(
      path.join(output.config.folderName, `${baseName}.gif`),
    );
    outputs.push(outPath);

    if (!manifestOnly) {
      const fullOutPath = path.join(outRoot, outPath);
      await ensureDir(path.dirname(fullOutPath));
      await fsp.copyFile(absPath, fullOutPath).catch(ignoreError);
    }

    sources.push({
      variant: output.key,
      type: "image/gif",
      path: `${config.paths.urlPrefix}/images/${outPath}`,
      width: knownWidth,
    });
  }

  const image: ImageEntry = {
    id: "img-" + toSlug(baseName),
    type: "image",
    src: path.basename(absPath),
    alt: "Animated GIF image",
    title: baseName,
    width: knownWidth,
    height: knownHeight,
    aspectRatio:
      knownWidth && knownHeight
        ? getAspectRatioName(knownWidth, knownHeight)
        : undefined,
    sources,
  };

  return {
    key,
    hash: fileHash,
    mtimeMs: stats.mtimeMs,
    bytes: stats.size,
    outputs,
    image,
  };
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

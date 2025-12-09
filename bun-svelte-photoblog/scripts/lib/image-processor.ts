import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import exifr from "exifr";
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
  sha1,
} from "./image-utils";
import { toSlug } from "../../src/lib/utils/strings"; // Corrected import

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
  "dc:creator"?: string | string[]; // Can be string or array
  Creator?: string;
  BylineTitle?: string;
  Artist?: string;
  Author?: string;
  Sublocation?: string;
  Orientation?: number; // Exifr might return number, manifest expects string
  DateTimeOriginal?: Date;
  CreateDate?: Date;
  Location?: string;
  City?: string;
  Copyright?: string;
  CopyrightNotice?: string;
  Category?: string;
  CategoryCode?: string;
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

function ignoreError(_err?: unknown): void {
  // Intentionally empty
}

export function buildOutputDefinitions(): OutputDefinition[] {
  return Object.entries(config.outputs).map(([k, value]) => ({
    key: k as keyof typeof config.outputs,
    mode: value.kind,
    config: value,
    isPlaceholder: Boolean(value.isPlaceholder) || k === "placeholder",
  }));
}

export async function processImage(
  absPath: string,
  options: ImageProcessOptions,
): Promise<ProcessedImageResult | null> {
  await loadSharpOrExplain();
  const sharpModule = requireSharp();
  const key = path.posix.normalize(path.relative(options.srcRoot, absPath));
  const baseName = path.basename(absPath, path.extname(absPath));

  try {
    const stats = await fsp.stat(absPath);
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(absPath);
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    const fileHash = hash.digest("hex");

    const ext = path.extname(absPath).slice(1).toLowerCase();

    // For GIF, we might still need buffer if we want to copy it exactly or process it
    // But let's optimize the common path first. For GIF copy we might need the buffer?
    // The original code passed fileBuffer to copyGif.
    // If it is a gif and we need to copy, we might read it.
    if (ext === "gif" && options.hasGifCopy) {
      // Only read buffer if we actually need it for gif copy (which seems to assume it)
      const buffer = await fsp.readFile(absPath);
      return await copyGif(absPath, buffer, stats, fileHash, options);
    }

    // Initialize sharp with file path instead of buffer
    const sharpInstance = sharpModule(absPath);

    // exifr can also read from file path, often faster as it only reads header
    const [imageStats, exifRaw, originalMeta] = await Promise.all([
      sharpInstance.stats(),
      exifr.parse(absPath, {
        exif: true,
        iptc: true,
        xmp: true,
        multiSegment: true,
      }),
      sharpInstance.metadata(),
    ]);

    const dominant = imageStats?.dominant || { r: 0, g: 0, b: 0 };
    const placeholderColor = `rgb(${dominant.r},${dominant.g},${dominant.b})`;

    const outputs: string[] = [];
    const sources: ImageSource[] = [];

    const imageEntry = await createImageEntry(
      baseName,
      absPath,
      exifRaw || {},
      originalMeta,
      placeholderColor,
    );

    const outputDefinitions = buildOutputDefinitions();

    for (const output of outputDefinitions) {
      if (output.mode === "variant") {
        const variantConfig = output.config;
        for (const format of options.formats) {
          const { outPath, info } = await generateVariant(
            sharpModule,
            absPath,
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
        const otherConfig = output.config;
        const { outPath, info } = await generateOtherOutput(
          sharpModule,
          absPath,
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

  return {
    id: "img-" + toSlug(baseName), // Using toSlug
    type: "image",
    src: path.basename(absPath),
    alt: getAltText(exif, captionCanonical, titleCanonical),
    title:
      [exif.Sublocation, exif.Location, exif.City].filter(Boolean).join(", ") ||
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
      date: (exif.DateTimeOriginal || exif.CreateDate)?.toISOString(),
      location: exif.Location,
      city: exif.City,
      sublocation: exif.Sublocation,
      latitude: exif.latitude,
      longitude: exif.longitude,
      orientation: exif.Orientation,
      description: normalizeText(exif.ImageDescription || undefined),
      keywords: getKeywords(exif),
      author: authorCanonical,
      copyright: normalizeText(exif.Copyright || exif.CopyrightNotice),
      category: normalizeText(exif.Category || exif.CategoryCode),
    },
    author: authorCanonical,
    authorSlug: authorCanonical ? toSlug(authorCanonical) : undefined, // Using toSlug
    date: (exif.DateTimeOriginal || exif.CreateDate)?.toISOString?.(),
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
    // delete resizeSpec.crop; // 'crop' is not in sharp types, but was in ResizeConfig interface
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
      size: 0, // Dummy size
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
    // For placeholders specifically, we might typically want the actual buffer to base64 it.
    // However, looking at the code, it seems it just puts the path in the manifest.
    // If output.isPlaceholder is true, it sets imageEntry.placeholder = outPath.
    // So we don't need the buffer content here either, just the dimensions.
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
    id: "img-" + toSlug(baseName), // Using toSlug
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

/**
 * Calculates output dimensions based on original size and resize config.
 * Mimics Sharp's simplified logic for 'cover', 'inside', etc.
 */
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

  // If both missing, no resize
  if (!targetW && !targetH) return { width: srcW, height: srcH };

  // If one missing, calculate preserving aspect ratio
  if (!targetH && targetW) {
    targetH = Math.round(srcH * (targetW / srcW));
  } else if (!targetW && targetH) {
    targetW = Math.round(srcW * (targetH / srcH));
  }

  // At this point both are numbers (or should be)
  if (!targetW) targetW = srcW;
  if (!targetH) targetH = srcH;

  // Handle withoutEnlargement
  if (!allowUpscale) {
    // If target is larger than source in both dims (for cover) or any dim (for inside), we might cap it.
    // For 'cover' (default/crop), if target > source, sharp usually upscales unless withoutEnlargement is true.
    // If withoutEnlargement is true, it returns the image clipped? Or just original?
    // Sharp docs: "do not enlarge if the width or height of the resized image would be greater than that of the source image"
    // For typical use case here (generating thumbnails), we assume upscale isn't happening or handled by config.
    // But strictly:
    if (targetW > srcW || targetH > srcH) {
      // logic gets complex depending on 'fit'.
      // For this specific project, we mostly downscale.
      // Let's implement a simple check: if we are trying to go bigger, just cap at src.
      if (fit === "inside" || fit === "contain") {
        const scale = Math.min(1, Math.min(targetW / srcW, targetH / srcH));
        targetW = Math.round(srcW * scale);
        targetH = Math.round(srcH * scale);
      } else if (fit === "cover" || fit === "fill") {
        // If strictly without enlargement and both are bigger, we return src?
        // Or if just one? Sharp is complex here.
        // Let's assume standard behavior: if target > src, use src.
        if (targetW > srcW && targetH > srcH) {
          targetW = srcW;
          targetH = srcH;
        }
      }
    }
  }

  return { width: targetW, height: targetH };
}

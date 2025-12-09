import fsp from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import type {
  ImageEntry,
  ImageSource,
  QualityTypes,
} from "../../src/lib/types/manifest";
import { ExifData as ManifestExifData } from "../../src/lib/types/manifest"; // Added this
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
  // Add other exifr-specific fields as needed that are not in ManifestExifData
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
    const fileBuffer = await fsp.readFile(absPath);
    const stats = await fsp.stat(absPath);
    const hash = sha1(fileBuffer);
    const ext = path.extname(absPath).slice(1).toLowerCase();

    if (ext === "gif" && options.hasGifCopy) {
      return await copyGif(absPath, fileBuffer, stats, options);
    }

    const sharpInstance = sharpModule(fileBuffer);
    const [imageStats, exifRaw, originalMeta] = await Promise.all([
      sharpInstance.stats(),
      exifr.parse(fileBuffer, {
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
            fileBuffer,
            baseName,
            variantConfig,
            format,
            options,
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
          fileBuffer,
          baseName,
          otherConfig,
          options,
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
      hash,
      mtimeMs: stats.mtimeMs,
      bytes: stats.size,
      outputs,
      image: imageEntry,
    };
  } catch (e: unknown) {
    logger.error(`Failed to process ${key}`, {
      error: e instanceof Error ? e.message : String(e),
    });
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
  fileBuffer: Buffer,
  resizeConfig: ResizeConfig,
  allowUpscale: boolean,
) {
  const resizeSpec = { ...resizeConfig };
  if (resizeSpec.crop) {
    resizeSpec.fit = "cover";
    delete resizeSpec.crop;
  }
  if (!allowUpscale) {
    resizeSpec.withoutEnlargement = true;
  }
  return sharpModule(fileBuffer).resize(resizeSpec);
}

async function generateVariant(
  sharpModule: SharpModule,
  fileBuffer: Buffer,
  baseName: string,
  variantConfig: VariantOutputConfig,
  format: ImageFormat,
  options: ImageProcessOptions,
) {
  const outExt = format === "jpeg" ? "jpg" : format;
  const variantFolder =
    format === ImageFormat.JPEG
      ? variantConfig.folderName
      : `${variantConfig.folderName}-${format}`;
  const outPath = path.posix.normalize(
    path.join(variantFolder, `${baseName}.${outExt}`),
  );

  const resizedInstance = buildSharpInstance(
    sharpModule,
    fileBuffer,
    variantConfig.resize,
    options.allowUpscale,
  );

  const quality = getQuality(format, options.qualityOverrides);
  applyFormat(resizedInstance, format, quality);

  let info;
  if (!options.manifestOnly) {
    const fullOutPath = path.join(options.outRoot, outPath);
    await ensureDir(path.dirname(fullOutPath));
    info = await resizedInstance.toFile(fullOutPath);
  } else {
    info = (await resizedInstance.toBuffer({ resolveWithObject: true })).info;
  }

  return { outPath, info };
}

async function generateOtherOutput(
  sharpModule: SharpModule,
  fileBuffer: Buffer,
  baseName: string,
  outputConfig: OtherOutputConfig,
  options: ImageProcessOptions,
) {
  const format =
    "format" in outputConfig ? outputConfig.format : ImageFormat.JPEG;
  const outExt = format === "jpeg" ? "jpg" : format;
  const outPath = path.posix.normalize(
    path.join(outputConfig.folderName, `${baseName}.${outExt}`),
  );

  const resizedInstance = buildSharpInstance(
    sharpModule,
    fileBuffer,
    outputConfig.resize || {},
    options.allowUpscale,
  );

  if ("blur" in outputConfig && outputConfig.blur) {
    resizedInstance.blur(10).png(config.encoding.sharp.blur.png);
  } else {
    const quality = getQuality(format, options.qualityOverrides);
    applyFormat(resizedInstance, format, quality);
  }

  let info;
  if (!options.manifestOnly) {
    const fullOutPath = path.join(options.outRoot, outPath);
    await ensureDir(path.dirname(fullOutPath));
    info = await resizedInstance.toFile(fullOutPath);
  } else {
    info = (await resizedInstance.toBuffer({ resolveWithObject: true })).info;
  }

  return { outPath, info };
}

async function copyGif(
  absPath: string,
  fileBuffer: Buffer,
  stats: import("fs").Stats,
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
    hash: sha1(fileBuffer),
    mtimeMs: stats.mtimeMs,
    bytes: stats.size,
    outputs,
    image,
  };
}

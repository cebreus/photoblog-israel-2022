import { execSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import xxhash from "xxhash-wasm";
import { ImageFormat } from "../../src/lib/types/images";
import type { ImageEntry, ImageSource, QualityTypes } from "../../src/lib/types/manifest";
import { config } from "../config";
import { aiService, EMBEDDING_DIM } from "./ai-models";
import { detectFaces, type FaceBox } from "./face-detection";
import {
  calculatePhash,
  calculateSharpness,
  ensureDir,
  getQualityBucket,
  normalizeSharpness,
} from "./image-utils";
import { createLogger } from "./logger";
// New Metadata Module Imports
import {
  buildImageEntry,
  cleanupMetadataTool,
  normalizeExifData,
  readRawMetadata,
} from "./metadata";
import { calculateSmartCrop } from "./smart-crop";

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

const logger = createLogger("images");

// --- Sharp Singleton ---

let sharp: SharpModule | null = null;

/**
 * Load the Sharp library or exit if it cannot be loaded.
 */
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
/**
 * Return the loaded Sharp instance or throw if missing.
 */
export function requireSharp(): SharpModule {
  if (!sharp) {
    throw new Error("Sharp instance not loaded");
  }
  return sharp;
}
/**
 * Perform cleanup of image processing tools and resources.
 */
export async function cleanup(): Promise<void> {
  await cleanupMetadataTool();
}
/**
 * Build a list of output definitions derived from config.outputs.
 */
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

let xxhashModule: any = null;

/**
 * Lazily loads and returns the xxhash-wasm module for hashing.
 */
async function getXxhash() {
  if (!xxhashModule) {
    xxhashModule = await (xxhash as any)();
  }
  return xxhashModule;
}

/**
 * Calculates the xxhash hash of a file at the given absolute path.
 */
async function calculateFileHash(absPath: string): Promise<string> {
  const { create64 } = await getXxhash();
  const hasher = create64();
  const stream = fs.createReadStream(absPath);
  for await (const chunk of stream) {
    hasher.update(chunk);
  }
  return hasher.digest().toString(16);
}

/**
 * Converts a HEIC/HEIF image to JPG using `vips` if necessary, returning the path to the processed image.
 */
async function convertHeicIfNeeded(
  absPath: string,
  baseName: string,
): Promise<{ processingPath: string; tempFilePath: string | null }> {
  const ext = path.extname(absPath).slice(1).toLowerCase();
  if (ext === "heic" || ext === "heif") {
    const tmpDir = os.tmpdir();
    const tempFilePath = path.join(tmpDir, `${baseName}_converted.jpg`);
    try {
      execSync(`vips copy "${absPath}" "${tempFilePath}"`);
      return { processingPath: tempFilePath, tempFilePath };
    } catch (convErr) {
      logger.warn(`Failed to convert HEIC via vips for ${absPath}: ${convErr}`);
      // Fallback to original, might fail if sharp/exiftool can't handle it well or identical to original
      return { processingPath: absPath, tempFilePath: null };
    }
  }
  return { processingPath: absPath, tempFilePath: null };
}

/**
 * Prepares the image context by determining paths, computing hash, and handling HEIC conversion.
 */
async function prepareImageContext(
  absPath: string,
  options: ImageProcessOptions,
  sharpModule: SharpModule,
) {
  const key = path.posix.normalize(path.relative(options.srcRoot, absPath));
  const baseName = path.basename(absPath, path.extname(absPath));
  const stats = await fsp.stat(absPath);
  const fileHash = await calculateFileHash(absPath);

  // HEIC Conversion
  const { processingPath, tempFilePath } = await convertHeicIfNeeded(absPath, baseName);
  const sharpInstance = sharpModule(processingPath);

  return {
    key,
    baseName,
    stats,
    fileHash,
    processingPath,
    tempFilePath,
    sharpInstance,
  };
}

/**
 * Determines if image analysis is required based on existing data and processing options.
 */
function determineAnalysisNeeds(fileHash: string, key: string, options: ImageProcessOptions) {
  let reusedAnalysis: Partial<ImageEntry["analysis"]> = {};
  let reusedExif: Partial<ImageEntry["exif"]> = {};
  let reusedOther: Partial<ImageEntry> = {};
  let shouldAnalyze = !options.manifestOnly || options.curation;

  if (options.previousEntry && options.oldHash && fileHash === options.oldHash) {
    const prev = options.previousEntry;
    reusedAnalysis = {
      sharpness: prev.analysis?.sharpness,
      phash: prev.analysis?.phash,
      embedding: prev.analysis?.embedding,
    };
    reusedExif = prev.exif || {};
    reusedOther = { placeholderColor: prev.placeholderColor };

    const isAnalysisValid =
      typeof reusedAnalysis.sharpness === "number" &&
      reusedAnalysis.sharpness > 0 &&
      typeof reusedAnalysis.phash === "string" &&
      reusedAnalysis.phash.length > 0 &&
      (!options.curation ||
        (Array.isArray(reusedAnalysis.embedding) &&
          reusedAnalysis.embedding.length === EMBEDDING_DIM));

    if (shouldAnalyze && !isAnalysisValid) {
      logger.verbose(`Hash match for ${key}, but re-analyzing due to missing/invalid data.`);
    } else {
      shouldAnalyze = false;
    }
  }

  // Manifest-only fallback check
  if (!shouldAnalyze) {
    const missingSharpness =
      typeof reusedAnalysis.sharpness !== "number" || reusedAnalysis.sharpness <= 0;
    const missingPhash =
      typeof reusedAnalysis.phash !== "string" || reusedAnalysis.phash.length === 0;
    if (missingSharpness || missingPhash) {
      shouldAnalyze = true;
    }
  }

  return { shouldAnalyze, reusedAnalysis, reusedExif, reusedOther };
}

/**
 * Gathers various image data such as EXIF, metadata, sharpness, pHash, and face detections.
 */
async function gatherImageData(
  absPath: string,
  processingPath: string,
  key: string,
  sharpModule: SharpModule,
  sharpInstance: ReturnType<SharpModule>,
  shouldAnalyze: boolean,
  reusedAnalysis: Partial<ImageEntry["analysis"]>,
  reusedOther: Partial<ImageEntry>,
  options: ImageProcessOptions,
) {
  // Parallel Data Gathering
  const placeholderMissingOrDefault =
    !reusedOther.placeholderColor || reusedOther.placeholderColor === "rgb(0,0,0)";
  const shouldComputeStats = shouldAnalyze || placeholderMissingOrDefault;

  const [imageStats, exifTags, originalMeta, rawSharpness, phash] = await Promise.all([
    shouldComputeStats ? sharpInstance.stats() : Promise.resolve(null),
    readRawMetadata(absPath),
    sharpInstance.metadata(),
    shouldAnalyze
      ? calculateSharpness(sharpModule, processingPath)
      : Promise.resolve((reusedAnalysis && reusedAnalysis.sharpness) ?? 0),
    shouldAnalyze
      ? calculatePhash(sharpModule, processingPath)
      : Promise.resolve((reusedAnalysis && reusedAnalysis.phash) ?? ""),
  ]);

  const normalizedSharpness = normalizeSharpness(rawSharpness);

  // Aesthetic Score (from reused analysis if not re-analyzing)
  const aesthetic = (reusedAnalysis && reusedAnalysis.aestheticScore) || 0;

  // Validation: warn if aestheticScore is missing (will result in "poor" quality bucket)
  if (aesthetic === 0 && !reusedAnalysis?.aestheticScore) {
    logger.verbose(
      `⚠️  aestheticScore missing for ${key}, qualityBucket will be "poor" until analyze-similarity runs`,
    );
  }

  const qualityBucket = getQualityBucket(aesthetic, normalizedSharpness);

  // AI Embedding
  let embedding: number[] | undefined = reusedAnalysis ? reusedAnalysis.embedding : undefined;
  if (shouldAnalyze && options.curation) {
    embedding = await aiService.generateEmbedding(processingPath);
  }

  // Metadata Normalization
  const exifRaw = normalizeExifData(exifTags);
  const dominant = imageStats?.dominant || { r: 0, g: 0, b: 0 };
  const placeholderColor =
    reusedOther.placeholderColor || `rgb(${dominant.r},${dominant.g},${dominant.b})`;

  // Face Detection
  let faces: FaceBox[] = [];
  if (!options.manifestOnly) {
    try {
      const detectWidth = 800;
      const buffer = await sharpModule(processingPath)
        .resize({ width: detectWidth, withoutEnlargement: true })
        .toBuffer();
      const detected = await detectFaces(buffer);
      const resizedMeta = await sharpModule(buffer).metadata();
      const scale = (originalMeta.width || 1) / (resizedMeta.width || 1);
      faces = detected.map((b) => ({
        x: b.x * scale,
        y: b.y * scale,
        width: b.width * scale,
        height: b.height * scale,
      }));
      if (faces.length > 0) logger.verbose(`Detected ${faces.length} faces in ${key}`);
    } catch (e) {
      logger.warn(`Face detection failed for ${key}: ${e}`);
    }
  }

  return {
    exifRaw,
    exifTags,
    originalMeta,
    sharpnessScore: normalizedSharpness,
    qualityBucket,
    aesthetic,
    phash,
    embedding,
    placeholderColor,
    faces,
  };
}
/**
 * Process a source image to produce outputs and an ImageEntry, returning metadata and output list.
 */
export async function processImage(
  absPath: string,
  options: ImageProcessOptions,
): Promise<ProcessedImageResult | null> {
  await loadSharpOrExplain();
  const sharpModule = requireSharp();

  let tempCleanupPath: string | null = null;
  // Ensure `key` exists in outer scope so catch block can reference it even if
  // an early error occurs during context preparation.
  let key: string | undefined;

  try {
    const context = await prepareImageContext(absPath, options, sharpModule);
    key = context.key;
    const { baseName, stats, fileHash, processingPath, sharpInstance, tempFilePath } = context;
    tempCleanupPath = tempFilePath;

    // 1. Reusability Check
    const analysisDecision = determineAnalysisNeeds(fileHash, key, options);
    const { shouldAnalyze, reusedAnalysis, reusedExif, reusedOther } = analysisDecision;

    // 2. Gather Image Data (metadata, analysis, faces)
    const imageData = await gatherImageData(
      absPath,
      processingPath,
      key,
      sharpModule,
      sharpInstance,
      shouldAnalyze,
      reusedAnalysis,
      reusedOther,
      options,
    );

    // Debug Filter (optional early return)
    if (process.env.FILTER_DATE) {
      const d = imageData.exifTags.DateTimeOriginal;
      let dateStr = "";
      if (d instanceof Date) dateStr = d.toISOString().split("T")[0];
      else if (typeof d === "string") dateStr = d.split(" ")[0].replace(/:/g, "-");
      if (dateStr && dateStr !== process.env.FILTER_DATE) return null;
    }

    // 3. Build Entry
    const imageEntry = buildImageEntry(
      baseName,
      absPath,
      imageData.exifRaw,
      imageData.originalMeta,
      imageData.placeholderColor,
      Number((stats.size / 1024 / 1024).toFixed(2)),
      {
        aestheticScore: imageData.aesthetic ?? 0,
        sharpness: imageData.sharpnessScore ?? 0,
        qualityBucket: imageData.qualityBucket,
        phash: imageData.phash ?? "",
        embedding: imageData.embedding ?? [],
      },
    );

    // 4. Output Generation
    const outputs: string[] = [];
    const sources: ImageSource[] = [];
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
            imageData.originalMeta,
            imageData.faces,
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
          imageData.originalMeta,
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
    logger.error(`Failed to process ${key ?? absPath}: ${msg}`);
    return null;
  } finally {
    if (tempCleanupPath) {
      try {
        await fsp.unlink(tempCleanupPath);
      } catch (_) {}
    }
  }
}

/**
 * Applies the specified image format and quality settings to a Sharp instance.
 */
function applyFormat(instance: ReturnType<SharpModule>, format: ImageFormat, quality: number) {
  if (format === ImageFormat.JPEG) instance.jpeg({ quality, ...config.encoding.sharp.jpeg });
  else if (format === ImageFormat.WEBP) instance.webp({ quality, ...config.encoding.sharp.webp });
  else if (format === ImageFormat.AVIF) instance.avif({ quality, ...config.encoding.sharp.avif });
}

/**
 * Determines the output quality for a given image format, considering overrides.
 */
function getQuality(
  format: ImageFormat,
  qualityOverrides: Partial<Record<QualityTypes, number>>,
): number {
  const qualityKey = format === ImageFormat.PNG ? ImageFormat.JPEG : format;
  return qualityOverrides[qualityKey] ?? config.encoding.quality[qualityKey];
}

/**
 * Builds a Sharp instance with the specified input, resize configuration, and upscale allowance.
 */
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

/**
 * Generate a variant image file for a given format and variant configuration.
 */
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
        variantConfig.resize.width!,
        variantConfig.resize.height!,
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

/**
 * Generate a non-variant output (for example placeholders) and return its path and info.
 */
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

/**
 * Calculate expected output dimensions given source size and resize rules.
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

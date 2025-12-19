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
  generateOtherOutput,
  generateVariant,
  type OtherOutputConfig,
  type VariantOutputConfig,
} from "./image-generator";
import { calculatePhash, calculateSharpness } from "./image-utils";
import { createLogger } from "./logger";
import {
  buildImageEntry,
  cleanupMetadataTool,
  normalizeExifData,
  type RawExifData,
  readRawMetadata,
} from "./metadata";

type SharpModule = typeof import("sharp");

interface ImageData {
  exifRaw: Partial<RawExifData>;
  exifTags: Record<string, unknown>;
  originalMeta: import("sharp").Metadata;
  sharpnessScore: number;
  phash: string;
  embedding?: number[];
  placeholderColor: string;
  faces: import("./face-detection").FaceBox[];
}
type OutputConfig = (typeof config.outputs)[keyof typeof config.outputs];

type OutputDefinition = {
  key: keyof typeof config.outputs;
  mode: "variant" | "other";
  config: OutputConfig;
  isPlaceholder: boolean;
};

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
  await cleanupMetadataTool();
}

export function buildOutputDefinitions(): OutputDefinition[] {
  return Object.entries(config.outputs).map(([k, value]) => {
    const isOther = value.kind === "other";
    return {
      key: k as keyof typeof config.outputs,
      mode: value.kind,
      config: value,
      isPlaceholder: isOther && Boolean((value as any).isPlaceholder),
    };
  });
}

let xxhashModule: any = null;
async function getXxhash() {
  if (!xxhashModule) {
    xxhashModule = await (xxhash as any)();
  }
  return xxhashModule;
}

async function calculateFileHash(absPath: string): Promise<string> {
  const { create64 } = await getXxhash();
  const hasher = create64();
  const stream = fs.createReadStream(absPath);
  for await (const chunk of stream) {
    hasher.update(chunk);
  }
  return hasher.digest().toString(16);
}

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
      return { processingPath: absPath, tempFilePath: null };
    }
  }
  return { processingPath: absPath, tempFilePath: null };
}

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

  if (!shouldAnalyze) {
    if (!reusedAnalysis.phash || !reusedAnalysis.sharpness) {
      shouldAnalyze = true;
    }
  }

  return { shouldAnalyze, reusedAnalysis, reusedExif, reusedOther };
}

async function extractFaces(
  sharpModule: SharpModule,
  processingPath: string,
  key: string,
  originalWidth: number,
  manifestOnly: boolean,
): Promise<FaceBox[]> {
  if (manifestOnly) return [];

  try {
    const detectWidth = 800;
    const buffer = await sharpModule(processingPath)
      .resize({ width: detectWidth, withoutEnlargement: true })
      .toBuffer();

    const detected = await detectFaces(buffer);
    const resizedMeta = await sharpModule(buffer).metadata();
    const scale = (originalWidth || 1) / (resizedMeta.width || 1);

    const faces = detected.map((b) => ({
      x: b.x * scale,
      y: b.y * scale,
      width: b.width * scale,
      height: b.height * scale,
    }));

    if (faces.length > 0) {
      logger.verbose(`Detected ${faces.length} faces in ${key}`);
    }
    return faces;
  } catch (e) {
    logger.warn(`Face detection failed for ${key}: ${e}`);
    return [];
  }
}

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
): Promise<ImageData> {
  const placeholderMissingOrDefault =
    !reusedOther.placeholderColor || reusedOther.placeholderColor === "rgb(0,0,0)";
  const shouldComputeStats = shouldAnalyze || placeholderMissingOrDefault;

  const [imageStats, exifTags, originalMeta, sharpnessScore, phash] = await Promise.all([
    shouldComputeStats ? sharpInstance.stats() : Promise.resolve(null),
    readRawMetadata(absPath),
    sharpInstance.metadata(),
    shouldAnalyze
      ? calculateSharpness(sharpModule, processingPath)
      : Promise.resolve(reusedAnalysis?.sharpness ?? 0),
    shouldAnalyze
      ? calculatePhash(sharpModule, processingPath)
      : Promise.resolve(reusedAnalysis?.phash ?? ""),
  ]);

  let embedding: number[] | undefined = reusedAnalysis?.embedding;
  if (shouldAnalyze && options.curation) {
    embedding = await aiService.generateEmbedding(processingPath);
  }

  const exifRaw = normalizeExifData(exifTags);
  const dominant = imageStats?.dominant || { r: 0, g: 0, b: 0 };
  const placeholderColor =
    reusedOther.placeholderColor || `rgb(${dominant.r},${dominant.g},${dominant.b})`;

  const faces = await extractFaces(
    sharpModule,
    processingPath,
    key,
    originalMeta.width || 1,
    options.manifestOnly,
  );

  return {
    exifRaw,
    exifTags,
    originalMeta,
    sharpnessScore,
    phash,
    embedding,
    placeholderColor,
    faces,
  };
}

function filterByDate(exifTags: Record<string, unknown>): boolean {
  if (!process.env.FILTER_DATE) return true;
  const d = exifTags.DateTimeOriginal;
  let dateStr = "";
  if (d instanceof Date) {
    dateStr = d.toISOString().split("T")[0];
  } else if (typeof d === "string") {
    dateStr = d.split(" ")[0].replace(/:/g, "-");
  }
  return !dateStr || dateStr === process.env.FILTER_DATE;
}

async function generateAllOutputs(
  sharpModule: SharpModule,
  processingPath: string,
  baseName: string,
  imageData: ImageData,
  options: ImageProcessOptions,
  imageEntry: ImageEntry,
) {
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

  return { outputs, sources };
}

export async function processImage(
  absPath: string,
  options: ImageProcessOptions,
): Promise<ProcessedImageResult | null> {
  await loadSharpOrExplain();
  const sharpModule = requireSharp();

  let tempCleanupPath: string | null = null;
  let key: string | undefined;

  try {
    const context = await prepareImageContext(absPath, options, sharpModule);
    key = context.key;
    const { baseName, stats, fileHash, processingPath, sharpInstance, tempFilePath } = context;
    tempCleanupPath = tempFilePath;

    // 1. Reusability Check
    const analysisDecision = determineAnalysisNeeds(fileHash, key, options);
    const { shouldAnalyze, reusedAnalysis, reusedOther } = analysisDecision;

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

    if (!filterByDate(imageData.exifTags)) return null;

    // 3. Build Entry
    const imageEntry = buildImageEntry(
      baseName,
      absPath,
      imageData.exifRaw,
      imageData.originalMeta,
      imageData.placeholderColor,
      Number((stats.size / 1024 / 1024).toFixed(2)),
      {
        sharpness: imageData.sharpnessScore ?? 0,
        phash: imageData.phash ?? "",
        embedding: imageData.embedding ?? [],
      },
    );

    // 4. Output Generation
    const { outputs, sources } = await generateAllOutputs(
      sharpModule,
      processingPath,
      baseName,
      imageData,
      options,
      imageEntry,
    );
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

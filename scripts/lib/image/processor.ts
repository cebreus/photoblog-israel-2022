/**
 * @fileoverview Image processing pipeline utilities.
 *
 * @description
 * Core image transformations, metadata extraction, quality scoring and encoding helpers used by the generator.
 */
import { aiService, EMBEDDING_DIM } from "$scripts/ai/models";
import { createLogger } from "$scripts/core/cli-logger";
import { detectFaces, type FaceBox } from "$scripts/faces/detection";
import { basenameNoExt, safeUnlink, stat } from "$scripts/utils/runtime";
import { ImageFormat } from "$shared/types/images";
import type { ImageEntry, ImageSource, QualityTypes } from "$shared/types/manifest";
import { createReadStream } from "node:fs";
import path from "node:path";
import xxhash from "xxhash-wasm";
import { config } from "../../build.config";
import {
  generateOtherOutput,
  generateVariant,
  type OtherOutputConfig,
  type VariantOutputConfig,
} from "./generator";
import {
  buildImageEntry,
  cleanupMetadataTool,
  normalizeExifData,
  type RawExifData,
  readRawMetadata,
} from "./metadata";
import { calculatePhash, calculateSharpness, prepareImageProcessingPath } from "./utils";

type SharpModule = typeof import("sharp");

interface ImageData {
  exifRaw: Partial<RawExifData>;
  exifTags: Record<string, unknown>;
  originalMeta: import("sharp").Metadata;
  sharpnessScore: number;
  phash: string;
  embedding?: number[];
  aestheticScore?: number;
  qualityBucket?: import("$shared/types/manifest").QualityBucket;
  peopleIds?: string[];
  placeholderColor?: string;
  faces: import("../faces/detection").FaceBox[];
  facesDetected: boolean;
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
  skipFaces?: boolean;
  skipEmbeddings?: boolean;
  srcRoot: string;
  outRoot: string;
  allowUpscale: boolean;
  formats: ImageFormat[];
  qualityOverrides: Partial<Record<QualityTypes, number>>;
  previousEntry?: ImageEntry;
  oldHash?: string;
  analysisManifest?: import("$shared/types/manifest").AnalysisManifest;
  embeddingsManifest?: import("$shared/types/manifest").EmbeddingsManifest;
  facesManifest?: import("$shared/types/manifest").FacesManifest;
};

const logger = createLogger("images");

let sharp: SharpModule | null = null;

export async function loadSharpOrExplain(): Promise<void> {
  if (sharp) return;
  try {
    const mod = (await import("sharp")) as unknown as { default: SharpModule } | SharpModule;
    sharp = "default" in mod ? mod.default : mod;
  } catch (err: unknown) {
    logger.error({ err }, "Failed to load sharp. Did you run bun install?");
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
      isPlaceholder: isOther && Boolean((value as { isPlaceholder?: boolean }).isPlaceholder),
    };
  });
}

let xxhashModule: Awaited<ReturnType<typeof xxhash>> | null = null;
async function getXxhash() {
  if (!xxhashModule) {
    xxhashModule = await xxhash();
  }
  return xxhashModule;
}

async function calculateFileHash(absPath: string): Promise<string> {
  const { create64 } = await getXxhash();
  const hasher = create64();

  const stream = createReadStream(absPath);
  for await (const chunk of stream) {
    hasher.update(chunk);
  }
  return hasher.digest().toString(16);
}

async function prepareImageContext(
  absPath: string,
  options: ImageProcessOptions,
  sharpModule: SharpModule,
) {
  const key = path.posix.normalize(path.relative(options.srcRoot, absPath));
  const baseName = basenameNoExt(absPath);
  const stats = await stat(absPath);
  const fileHash = await calculateFileHash(absPath);

  const { processingPath, tempFile } = await prepareImageProcessingPath(absPath);
  const sharpInstance = sharpModule(processingPath);

  return {
    key,
    baseName,
    stats,
    fileHash,
    processingPath,
    tempFile,
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
    };
    reusedExif = prev.exif || {};
    reusedOther = { placeholderColor: prev.placeholderColor };

    // Extract ID for manifest lookup (embeddings manifest is keyed by ID)
    const id = basenameNoExt(key);
    const embedding = options.embeddingsManifest?.[id];
    const isEmbeddingValid =
      !options.curation || (Array.isArray(embedding) && embedding.length === EMBEDDING_DIM);

    const isAnalysisValid =
      typeof reusedAnalysis.sharpness === "number" &&
      reusedAnalysis.sharpness > 0 &&
      typeof reusedAnalysis.phash === "string" &&
      reusedAnalysis.phash.length > 0 &&
      isEmbeddingValid;

    if (shouldAnalyze && !isAnalysisValid) {
      logger.verbose(
        { key, reason: "invalid_cache" },
        "Hash match but re-analyzing due to missing/invalid data",
      );
    } else {
      shouldAnalyze = false;
    }
  }

  // In manifestOnly mode, never force analysis for missing data.
  // Missing data will be computed during full `pnpm process`.
  // Only force re-analysis when NOT in manifestOnly mode AND data is missing.
  if (!shouldAnalyze && !options.manifestOnly) {
    if (!reusedAnalysis.phash || !reusedAnalysis.sharpness) {
      shouldAnalyze = true;
    }
  }

  return {
    shouldAnalyze,
    reusedAnalysis,
    reusedExif,
    reusedOther: { ...reusedOther, people: options.previousEntry?.people },
  };
}

async function _extractFaces(
  sharpModule: SharpModule,
  processingPath: string,
  key: string,
  originalWidth: number,
  options: ImageProcessOptions,
  existingFaces?: Array<{ x: number; y: number; width: number; height: number }>,
): Promise<FaceBox[]> {
  if (options.manifestOnly || options.skipFaces) return [];
  if (existingFaces && existingFaces.length > 0) return existingFaces;

  try {
    const detectWidth = 800;
    const buffer = await sharpModule(processingPath)
      .rotate()
      .resize({ width: detectWidth, withoutEnlargement: true })
      .toFormat("jpeg")
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
      logger.verbose({ key, count: faces.length }, "Face detection completed");
    }
    return faces;
  } catch (e) {
    logger.error({ key, err: e }, "Face detection failed");
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
  // Extract image ID from key (basename without extension)
  // Split manifests are keyed by ID, not by relative path
  const baseName = basenameNoExt(key);
  const id = baseName;

  const analysisFromManifest = options.analysisManifest?.[id];
  const embeddingFromManifest = options.embeddingsManifest?.[id];
  const facesFromManifest = options.facesManifest?.[id];

  const placeholderMissingOrDefault =
    !reusedOther.placeholderColor || reusedOther.placeholderColor === "rgb(0,0,0)";
  // In manifestOnly mode, skip stats computation entirely - placeholder color will be computed during full process
  const shouldComputeStats =
    !options.manifestOnly && (shouldAnalyze || placeholderMissingOrDefault);

  const [imageStats, exifTags, originalMeta, sharpnessScore, phash] = await Promise.all([
    shouldComputeStats ? sharpInstance.stats() : Promise.resolve(null),
    readRawMetadata(absPath),
    sharpInstance.rotate().metadata(),
    shouldAnalyze
      ? calculateSharpness(sharpModule, processingPath)
      : Promise.resolve(analysisFromManifest?.sharpness ?? reusedAnalysis?.sharpness ?? 0),
    shouldAnalyze
      ? calculatePhash(sharpModule, processingPath)
      : Promise.resolve(analysisFromManifest?.phash ?? reusedAnalysis?.phash ?? ""),
  ]);

  let embedding = embeddingFromManifest;
  if (shouldAnalyze && options.curation && !options.skipEmbeddings && !embedding) {
    embedding = await aiService.generateEmbedding(processingPath);
  }

  const exifRaw = normalizeExifData(exifTags);
  const dominant = imageStats?.dominant || { r: 0, g: 0, b: 0 };

  // In manifestOnly mode, don't fill in default color - leave undefined if not cached
  let placeholderColor = reusedOther.placeholderColor;
  if (!placeholderColor && !options.manifestOnly) {
    placeholderColor = `rgb(${dominant.r},${dominant.g},${dominant.b})`;
  }

  const existingFaces = facesFromManifest?.faces ?? reusedAnalysis?.faces;
  const faces = await _extractFaces(
    sharpModule,
    processingPath,
    key,
    originalMeta.width ?? 0,
    options,
    existingFaces,
  );

  const facesDetected = faces.length > 0;
  const peopleIds = facesFromManifest?.peopleIds ?? reusedOther.people ?? [];
  const aestheticScore = analysisFromManifest?.aestheticScore ?? reusedAnalysis?.aestheticScore;
  const qualityBucket = analysisFromManifest?.qualityBucket ?? reusedAnalysis?.qualityBucket;

  return {
    exifRaw,
    exifTags,
    originalMeta,
    sharpnessScore,
    phash,
    embedding,
    aestheticScore,
    qualityBucket,
    peopleIds,
    placeholderColor,
    faces,
    facesDetected,
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
    // Panorama detection: check specialMedia metadata
    const isPano = imageEntry.specialMedia?.isPanorama ?? false;

    // Optimization: only generate pano_detail for actual panoramas
    if (output.key === "pano_detail" && !isPano) {
      continue;
    }

    // Optimization: skip standard detail for panoramas (we have pano_detail instead)
    if (output.key === "detail" && isPano) {
      continue;
    }

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
        imageData.faces,
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

import { isCollage } from "$shared/utils/strings";
import { readClapFromFile } from "./clap-parser";
import { applyClapExtract } from "./clap-utils";

export async function processImage(
  absPath: string,
  options: ImageProcessOptions & { skipFaces?: boolean; skipEmbeddings?: boolean },
): Promise<ProcessedImageResult | null> {
  const _startTime = performance.now();
  await loadSharpOrExplain();
  const sharpModule = requireSharp();

  let tempFile: string | null = null;
  let clapTempPath: string | null = null;
  let key: string | undefined;

  try {
    const context = await prepareImageContext(absPath, options, sharpModule);
    key = context.key;
    const { baseName, stats, fileHash, processingPath, tempFile: contextTempFile } = context;
    let { sharpInstance } = context;
    tempFile = contextTempFile;

    // --- Clean Aperture Application ---
    let effectiveInput = processingPath;
    let finalClapUsed: ImageEntry["clap"];

    // Skip for collages (they shouldn't have clap, but just in case)
    if (!isCollage(baseName)) {
      // FILE-BASED TRUTH: Only use clap if it exists in the file (native or XMP)
      finalClapUsed = (await readClapFromFile(absPath)) || undefined;

      if (finalClapUsed) {
        logger.verbose({ key }, "Found ořez in file");

        try {
          const croppedPath = await applyClapExtract(sharpModule, processingPath, finalClapUsed);
          clapTempPath = croppedPath;
          effectiveInput = croppedPath;

          // Re-create sharp instance for the cropped image so subsequent ops (stats, metadata) use the crop
          sharpInstance = sharpModule(effectiveInput);
        } catch (e: any) {
          logger.warn({ key, err: (e as Error).message }, "Failed to apply clap, using original");
        }
      }
    }
    // ----------------------------------

    // 1. Reusability Check
    const analysisDecision = determineAnalysisNeeds(fileHash, key, options);
    const { shouldAnalyze, reusedAnalysis, reusedOther } = analysisDecision;

    // 2. Gather Image Data (metadata, analysis, faces)
    const imageData = await gatherImageData(
      absPath,
      effectiveInput, // Use effectiveInput (potentially cropped)
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
      imageData.placeholderColor ?? "",
      Number((stats.size / 1024 / 1024).toFixed(2)),
      {
        sharpness: imageData.sharpnessScore ?? 0,
        phash: imageData.phash ?? "",
        aestheticScore: imageData.aestheticScore,
        qualityBucket: imageData.qualityBucket,
        facesDetected: imageData.facesDetected,
        faces: imageData.faces,
      },
      finalClapUsed,
    );
    imageEntry.people = imageData.peopleIds;

    // 4. Output Generation
    const { outputs, sources } = await generateAllOutputs(
      sharpModule,
      effectiveInput,
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
    const error = e instanceof Error ? e : new Error(String(e));
    logger.error(
      {
        id: key ?? absPath,
        message: error.message,
        stack: error.stack,
      },
      "Failed to process image",
    );
    return null;
  } finally {
    await safeUnlink(tempFile);
    await safeUnlink(clapTempPath);
  }
}

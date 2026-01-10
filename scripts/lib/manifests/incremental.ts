import { EMBEDDING_DIM } from "$scripts/ai/models";
import { createLogger } from "$scripts/core/cli-logger";
import { getConcurrency } from "$scripts/core/concurrency-utils";
import { createBar, stopAllBars } from "$scripts/core/progress-manager";
import type { ProcessedImageResult } from "$scripts/image/processor";
import { type ImageProcessOptions, processImage } from "$scripts/image/processor";
import {
  detectRenames,
  loadContentTracker,
  migrateReferences,
  saveContentTracker,
  updateContentTracker,
} from "$scripts/utils/content-tracker";
import { logResourceUsage } from "$scripts/utils/performance";
import { fileExists, readFileText, rm, safeUnlink, scanGlob, stat } from "$scripts/utils/runtime";
import { formatDuration } from "$scripts/utils/time";
import { ImageFormat } from "$shared/types/images";
import type { Cache, ImageEntry, Manifest, StoryDataMap } from "$shared/types/manifest";
import { toPureWallClockISO } from "$shared/utils/dates";
import matter from "gray-matter";
import path from "node:path";
import pc from "picocolors";
import { config } from "../../build.config";
import { buildGeneratorManifest, generateMenuManifest, updateManifest } from "./builder";
import { withManifestLock } from "./lock";
// Repository Imports
import {
  loadAnalysisManifest,
  loadEmbeddingsManifest,
  loadFacesManifest,
  loadManifest,
  saveAnalysisManifest,
  saveFacesManifest,
  saveImagesManifest,
  saveManifest,
} from "./repository";

const logger = createLogger("incremental-build");

/**
 * Validates story data from markdown and logs warnings for common issues.
 * This helps catch configuration problems early during build.
 */
function validateStoryData(
  story: {
    location?: string;
    startDate?: string;
    endDate?: string;
    visits?: Array<{ startDate?: string; endDate?: string }>;
  },
  filename: string,
): void {
  const warnings: string[] = [];

  // Only validate location-based stories (not day stories)
  if (!story.location) return;

  // Check if any dates are defined
  const hasRootDates = story.startDate || story.endDate;
  const hasVisits = story.visits && story.visits.length > 0;

  if (!hasRootDates && !hasVisits) {
    warnings.push("No dates defined (startDate, endDate, or visits required for separators)");
  }

  // Validate root date range
  if (story.startDate && story.endDate && story.startDate > story.endDate) {
    warnings.push(`startDate > endDate: ${story.startDate} > ${story.endDate}`);
  }

  // Validate visits
  if (story.visits) {
    for (let i = 0; i < story.visits.length; i++) {
      const visit = story.visits[i];
      if (!visit.startDate && !visit.endDate) {
        warnings.push(`Visit #${i + 1} has no dates`);
      }
      if (visit.startDate && visit.endDate && visit.startDate > visit.endDate) {
        warnings.push(
          `Visit #${i + 1}: startDate > endDate: ${visit.startDate} > ${visit.endDate}`,
        );
      }
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn(
      { filename, issues: warnings.length, detail: warnings },
      `Markdown validation issues in "${filename}":\n${warnings.map((w) => `  - ${w}`).join("\n")}`,
    );
  }
}

export async function loadStoryData(contentRoot: string): Promise<StoryDataMap> {
  const storyFiles: string[] = [];

  const files = await scanGlob("**/*.md", { cwd: contentRoot, absolute: true });
  storyFiles.push(...files);
  const storyDataMap: StoryDataMap = {};
  for (const file of storyFiles) {
    try {
      const fileContent = await readFileText(file);
      const { data, content } = matter(fileContent);
      if (data.type === "settings") continue;
      const storyBody = (data.content || content).trim();
      const filename = path.basename(file, ".md");

      // Determine startDate: priority is data.startDate > data.date
      const startDateRaw = data.startDate || data.date;
      const startDate = toPureWallClockISO(startDateRaw);
      const endDate = toPureWallClockISO(data.endDate);

      const visits = Array.isArray(data.visits)
        ? data.visits.map((v: any) => ({
            startDate: toPureWallClockISO(v.startDate),
            endDate: toPureWallClockISO(v.endDate),
          }))
        : undefined;

      // Location key: use location field, or derive from date if present
      const locationKey = data.location || (startDate ? startDate.substring(0, 10) : filename);

      const storyData = {
        title: data.title || "",
        content: storyBody,
        location: data.location || undefined,
        city: data.city || undefined,
        date: data.date ? toPureWallClockISO(data.date)?.substring(0, 10) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        visits,
      };

      // Validate story data and warn about issues
      validateStoryData(storyData, filename);

      storyDataMap[locationKey] = storyData;
    } catch (e: unknown) {
      logger.warn(
        { file, error: e instanceof Error ? e.message : String(e) },
        "Could not parse story file",
      );
    }
  }
  logger.verbose({ count: Object.keys(storyDataMap).length }, "Loaded story entries from Markdown");
  return storyDataMap;
}

async function generateSiteManifest(): Promise<Record<string, unknown>> {
  const siteMdPath = path.resolve(process.cwd(), config.paths.siteSource, "site.md");
  if (!(await fileExists(siteMdPath))) {
    logger.warn({ path: siteMdPath }, "site.md not found");
    return {};
  }
  try {
    const content = await readFileText(siteMdPath);
    const { data } = matter(content);
    return data as Record<string, unknown>;
  } catch (e: unknown) {
    logger.error(
      { path: siteMdPath, error: e instanceof Error ? e.message : String(e) },
      "Failed to parse site.md",
    );
    return {};
  }
}
async function detectChanges(
  sourceFiles: string[],
  cache: Cache,
  srcRoot: string,
  outRoot: string,
  manifestOnly: boolean,
  previousEntries: Map<string, ImageEntry>,
  isCuration: boolean,
  embeddingsManifest?: Record<string, number[]>,
  force = false,
) {
  const toProcess: string[] = [];
  const knownKeys = new Set(Object.keys(cache.files));

  for (const file of sourceFiles) {
    const key = path.posix.normalize(path.relative(srcRoot, file));
    knownKeys.delete(key);
    const stats = await stat(file);
    const cached = cache.files[key];
    const baseName = path.basename(file);

    if (force || !cached || cached.mtimeMs !== stats.mtimeMs || !previousEntries.has(baseName)) {
      if (force) {
        logger.verbose({ key, force: true }, "Force processing enabled");
      } else if (!cached || cached.mtimeMs !== stats.mtimeMs) {
        // Changed or new
      } else {
        logger.verbose(
          { key, reason: "missing_from_manifest" },
          "Image is in cache but missing from manifest, forcing re-process to restore metadata",
        );
      }
      toProcess.push(file);
      continue;
    }

    if (isCuration) {
      const prev = previousEntries.get(baseName);
      if (prev) {
        const embedding = embeddingsManifest?.[prev.id];
        if (!embedding || !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
          logger.verbose(
            { key, reason: "missing_embedding" },
            "Stale or missing embedding, forcing re-process",
          );
          toProcess.push(file);
          continue;
        }
      }
    }

    if (!manifestOnly) {
      function buildOutPath(outPath: string) {
        return path.join(outRoot, outPath);
      }

      async function checkOutputExists(outPath: string) {
        try {
          return await fileExists(buildOutPath(outPath));
        } catch {
          return false;
        }
      }

      function isMissing(exists: boolean) {
        return !exists;
      }

      const outputsExist = await Promise.all(cached.outputs.map(checkOutputExists));

      if (outputsExist.some(isMissing)) {
        logger.verbose({ key, file }, "Output file missing, reprocessing");
        toProcess.push(file);
      }
    }
  }
  return { toProcess, toDelete: Array.from(knownKeys) };
}

async function loadCache(
  cachePath: string,
  configHash: string,
  outRoot: string,
  cacheVersion: number,
  manifestOnly: boolean,
) {
  const cache = (await loadManifest<Cache>(cachePath)) || {
    version: cacheVersion,
    configHash: "",
    files: {},
  };

  const wasReset = false;
  if (cache.configHash !== configHash || cache.version !== cacheVersion) {
    logger.warn(
      {
        currentHash: configHash,
        cacheHash: cache.configHash,
        currentVer: cacheVersion,
        cacheVer: cache.version,
      },
      "Config, cache version, or script change detected. Forcing full rebuild.",
    );
    try {
      if (!manifestOnly) {
        await rm(outRoot, { recursive: true });
      } else {
        logger.info(
          { manifestOnly: true, outRoot },
          "Skipping output cleanup in manifest-only mode.",
        );
      }
    } catch {}
    return {
      cache: { version: cacheVersion, configHash, files: {} },
      wasReset: true,
    };
  }
  return { cache, wasReset };
}

async function findSourceFiles(srcRoot: string, limit: number | 0) {
  const inputExts = config.script.inputExtensions;
  const sourceFiles = await scanGlob(`**/*.{${inputExts.join(",")}}`, {
    cwd: srcRoot,
    absolute: true,
    dot: false,
  });
  // Filter out special directories (archive, collage-sources) to prevent them being processed as gallery images
  const filteredFiles = sourceFiles.filter((file) => {
    const relPath = path.relative(srcRoot, file);
    const topDir = relPath.split(path.sep)[0];
    return topDir !== "archive" && topDir !== "collage-sources";
  });

  if (limit > 0) filteredFiles.splice(limit);
  return filteredFiles;
}

function buildOutputFilePath(outRoot: string, relativePath: string) {
  return path.join(outRoot, relativePath);
}

async function unlinkOutputFile(outRoot: string, relativePath: string): Promise<void> {
  await safeUnlink(buildOutputFilePath(outRoot, relativePath));
}

async function deleteCacheEntry(cache: Cache, outRoot: string, key: string) {
  const outputs = cache.files[key]?.outputs || [];
  delete cache.files[key];
  await Promise.all(outputs.map((relativePath) => unlinkOutputFile(outRoot, relativePath)));
}

async function pruneDeleted(toDelete: string[], cache: Cache, outRoot: string) {
  if (toDelete.length === 0) return;

  function deleteEntry(key: string) {
    return deleteCacheEntry(cache, outRoot, key);
  }

  await Promise.all(toDelete.map(deleteEntry));
}

async function processImages(
  toProcess: string[],
  {
    concurrency,
    quiet,
    verbose,
    ...options
  }: {
    concurrency: number | "auto";
    quiet: boolean;
    verbose?: boolean;
    previousEntriesMap?: Map<string, ImageEntry>;
    oldCache?: Cache;
  } & ImageProcessOptions,
  processImageFn = processImage,
): Promise<ProcessedImageResult[]> {
  if (toProcess.length === 0) return [];

  const resolvedConcurrency = getConcurrency(concurrency);
  logger.info(
    { threads: resolvedConcurrency },
    `Using concurrency: ${resolvedConcurrency} threads`,
  );
  const bar = quiet ? null : createBar(toProcess.length, "[images]", { suffix: "| Processing" });

  // bar?.start(toProcess.length, 0); // createBar already initializes

  const results: ProcessedImageResult[] = [];
  let index = 0;
  let processedCount = 0;

  const workerLoop = async () => {
    while (index < toProcess.length) {
      const pos = index++;
      if (pos >= toProcess.length) break;
      const filePath = toProcess[pos];
      const key = path.posix.normalize(path.relative(options.srcRoot, filePath));
      const oldHash = options.oldCache?.files?.[key]?.hash;
      const baseName = path.basename(filePath);
      const previousEntry = options.previousEntriesMap?.get(baseName);

      const res = await processImageFn(filePath, { ...options, oldHash, previousEntry });
      if (res) results.push(res);
      bar?.increment();

      processedCount++;
      if (processedCount % 50 === 0) {
        logResourceUsage(`progress-${processedCount}`);
      }
    }
  };

  const pool = Array.from({ length: resolvedConcurrency }, workerLoop);
  await Promise.all(pool);

  if (bar) {
    bar.stop();
    stopAllBars();
  }

  return results;
}
/**
 * Merges split manifests (analysis, faces) into the main images manifest.
 * This ensures that AI-generated metadata and face detection data are preserved
 * even when images are cached and not reprocessed.
 * Reconstructs the analysis object with consistent key order.
 */
async function mergeSplitManifestsIntoImages(manifest: Manifest, dataDir: string): Promise<void> {
  const analysisManifest = (await loadAnalysisManifest(dataDir)) || {};
  const facesManifest = (await loadFacesManifest(dataDir)) || {};

  let mergedCount = 0;

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type !== "image" && item.type !== "sequence" && item.type !== "sequence-member") {
        continue;
      }

      const id = item.id;
      const analysisData = analysisManifest[id];
      const facesData = facesManifest[id];

      // Get existing values or defaults
      const existing = item.analysis ?? {
        sharpness: 0,
        phash: "",
        facesDetected: false,
        faces: [] as Array<{ x: number; y: number; width: number; height: number }>,
      };
      const sharpness = analysisData?.sharpness ?? existing.sharpness ?? 0;
      const phash = analysisData?.phash ?? existing.phash ?? "";
      const aestheticScore = analysisData?.aestheticScore ?? existing.aestheticScore;
      const qualityBucket = analysisData?.qualityBucket ?? existing.qualityBucket;
      const facesDetected = facesData?.facesDetected ?? existing.facesDetected ?? false;
      const faces = facesData?.faces ?? existing.faces ?? [];

      // Reconstruct analysis object with consistent key order:
      // aestheticScore, sharpness, qualityBucket, phash, facesDetected, faces
      const newAnalysis: typeof item.analysis = {
        sharpness,
        phash,
        facesDetected,
        faces,
      };

      // Add optional fields in correct order (before sharpness)
      if (aestheticScore !== undefined) {
        newAnalysis.aestheticScore = aestheticScore;
      }
      if (qualityBucket !== undefined) {
        newAnalysis.qualityBucket = qualityBucket;
      }

      // Rebuild with correct order: aestheticScore, sharpness, qualityBucket, phash, facesDetected, faces
      item.analysis = {
        ...(aestheticScore !== undefined ? { aestheticScore } : {}),
        sharpness,
        ...(qualityBucket !== undefined ? { qualityBucket } : {}),
        phash,
        facesDetected,
        faces,
      };

      // Merge people IDs
      if (facesData?.peopleIds && facesData.peopleIds.length > 0) {
        item.people = facesData.peopleIds;
        mergedCount++;
      } else if (facesData) {
        mergedCount++;
      }
    }
  }

  if (mergedCount > 0) {
    logger.verbose(`Merged split manifest data for ${mergedCount} images.`);
  }
}

async function updateCacheAndManifests({
  cache,
  results,
  toDelete,
  storyData,
  paths,
  shouldWriteSiteManifests,
  configHash,
  wasReset,
  outRoot,
}: {
  cache: Cache;
  results: ProcessedImageResult[];
  toDelete: string[];
  storyData: StoryDataMap;
  paths: {
    cachePath: string;
    generatorManifestPath: string;
    manifestPath: string;
    menuManifestPath: string;
    siteManifestPath: string;
  };
  shouldWriteSiteManifests: boolean;
  configHash: string;
  wasReset: boolean;
  outRoot: string;
}) {
  for (const res of results) {
    cache.files[res.key] = {
      hash: res.hash,
      mtimeMs: res.mtimeMs,
      outputs: res.outputs,
    };
  }
  cache.configHash = configHash;

  const generatorManifest = buildGeneratorManifest(results);

  let finalManifest: Manifest = { photoDays: [] };
  if (shouldWriteSiteManifests) {
    // Re-load previous manifest using Generic loader, or use empty
    const existingManifest = wasReset
      ? { photoDays: [] }
      : (await loadManifest<Manifest>(paths.manifestPath)) || { photoDays: [] };

    finalManifest = updateManifest(results, toDelete, storyData, existingManifest);

    // Always merge split manifest data into the main manifest
    // This ensures data from face-clustering, analyze-similarity, etc. is preserved
    const dataDir = path.dirname(paths.manifestPath);
    await mergeSplitManifestsIntoImages(finalManifest, dataDir);
  }

  const savePromises = [
    saveManifest(paths.cachePath, cache),
    saveManifest(paths.generatorManifestPath, generatorManifest),
  ];

  if (shouldWriteSiteManifests) {
    savePromises.push(saveImagesManifest(path.dirname(paths.manifestPath), finalManifest));

    const menuManifest = generateMenuManifest(finalManifest, storyData);
    savePromises.push(saveManifest(paths.menuManifestPath, menuManifest));

    const siteManifest = await generateSiteManifest();
    savePromises.push(saveManifest(paths.siteManifestPath, siteManifest));

    // Save split manifests (BUG #5 fix: prevent data loss on cache reset)
    if (results.length > 0) {
      // Build analysis entries from results
      type AnalysisEntryType = {
        sharpness: number;
        phash: string;
        aestheticScore?: number;
        qualityBucket?: "excellent" | "good" | "poor";
      };
      const analysisEntries: Record<string, AnalysisEntryType> = {};
      type FacesEntryType = {
        facesDetected: boolean;
        faces: Array<{ x: number; y: number; width: number; height: number }>;
        peopleIds: string[];
      };
      const facesEntries: Record<string, FacesEntryType> = {};

      for (const res of results) {
        const img = res.image;
        if (img.analysis) {
          analysisEntries[img.id] = {
            sharpness: img.analysis.sharpness,
            phash: img.analysis.phash,
            aestheticScore: img.analysis.aestheticScore,
            qualityBucket: img.analysis.qualityBucket,
          };
        }
        if (img.analysis?.faces || img.analysis?.facesDetected !== undefined) {
          facesEntries[img.id] = {
            facesDetected: img.analysis.facesDetected ?? false,
            faces: img.analysis.faces ?? [],
            peopleIds: img.people ?? [],
          };
        }
      }

      if (Object.keys(analysisEntries).length > 0) {
        // Merge with existing analysis manifest
        const existingAnalysis = (await loadAnalysisManifest(outRoot)) ?? {};
        const mergedAnalysis = { ...existingAnalysis, ...analysisEntries };
        savePromises.push(saveAnalysisManifest(outRoot, mergedAnalysis));
      }

      if (Object.keys(facesEntries).length > 0) {
        // Merge with existing faces manifest
        const existingFaces = (await loadFacesManifest(outRoot)) ?? {};
        const mergedFaces = { ...existingFaces, ...facesEntries };
        savePromises.push(saveFacesManifest(outRoot, mergedFaces));
      }
    }
  }

  await Promise.all(savePromises);
}

async function loadBuildResourceState(
  CTX: {
    contentRoot: string;
    cachePath: string;
    configHash: string;
    outRoot: string;
    manifestPath: string;
  },
  cacheVersion: number,
  storyLoader: typeof loadStoryData,
  manifestOnly: boolean,
) {
  const { cache, wasReset } = await loadCache(
    CTX.cachePath,
    CTX.configHash,
    CTX.outRoot,
    cacheVersion,
    manifestOnly,
  );
  const storyData = await storyLoader(CTX.contentRoot);
  const previousManifest = (await loadManifest<Manifest>(CTX.manifestPath)) || { photoDays: [] };

  const previousEntries = new Map<string, ImageEntry>();
  for (const day of previousManifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.src) {
        previousEntries.set(item.src, item);
      }
    }
  }

  // Load split manifests from data directory (same location as main manifest)
  const dataDir = path.dirname(CTX.manifestPath);
  const analysisManifest = (await loadAnalysisManifest(dataDir)) || {};
  const embeddingsManifest = (await loadEmbeddingsManifest(dataDir)) || {};
  const facesManifest = (await loadFacesManifest(dataDir)) || {};

  return {
    cache,
    wasReset,
    storyData,
    previousEntries,
    analysisManifest,
    embeddingsManifest,
    facesManifest,
  };
}

/**
 * Detect ghost entries: manifest entries that reference files no longer on disk.
 * This handles the case where files are deleted but cache was cleared,
 * leaving orphaned entries in the manifest.
 */
function detectGhostManifestEntries(
  sourceFiles: string[],
  previousEntries: Map<string, ImageEntry>,
): string[] {
  // Build a set of basenames from physical files
  const physicalBasenames = new Set(sourceFiles.map((f) => path.basename(f)));

  // Find manifest entries that don't have corresponding physical files
  const ghostKeys: string[] = [];
  for (const [src] of previousEntries) {
    if (!physicalBasenames.has(src)) {
      // This is a ghost entry - in manifest but no file on disk
      ghostKeys.push(src);
    }
  }

  if (ghostKeys.length > 0) {
    logger.warn(
      `Found ${ghostKeys.length} ghost manifest entries (no matching files): ${ghostKeys.slice(0, 5).join(", ")}${ghostKeys.length > 5 ? "..." : ""}`,
    );
  }

  return ghostKeys;
}

async function planBuildWork(
  CTX: { srcRoot: string; outRoot: string },
  ARGS: {
    limit: number;
    manifestOnly: boolean;
    curation: boolean;
    filter?: string;
    force: boolean;
  },
  cache: Cache,
  previousEntries: Map<string, ImageEntry>,
  embeddingsManifest: Record<string, number[]>,
) {
  const sourceFiles = await findSourceFiles(CTX.srcRoot, ARGS.limit);
  const audit = await detectChanges(
    sourceFiles,
    cache,
    CTX.srcRoot,
    CTX.outRoot,
    ARGS.manifestOnly,
    previousEntries,
    ARGS.curation,
    embeddingsManifest,
    ARGS.force,
  );

  // Also detect ghost manifest entries (files deleted but manifest not updated)
  const ghostEntries = detectGhostManifestEntries(sourceFiles, previousEntries);

  // Merge ghost entries with toDelete (deduplicated)
  const allToDelete = [...new Set([...audit.toDelete, ...ghostEntries])];

  // Apply filter if present
  let finalToProcess = audit.toProcess;
  if (ARGS.filter) {
    logger.info({ filter: ARGS.filter }, "Applying filter");
    const filterValue = ARGS.filter; // capture for use in closure
    finalToProcess = audit.toProcess.filter((f) => {
      const base = path.basename(f);
      return base.includes(filterValue) || f.includes(filterValue);
    });
    if (finalToProcess.length === 0) {
      logger.warn({ filter: ARGS.filter }, "Filter matched no files in the toProcess queue.");
    }
  }

  return { sourceFiles, toProcess: finalToProcess, toDelete: allToDelete };
}

async function _processBuildQueue(
  CTX: { srcRoot: string; outRoot: string },
  ARGS: {
    concurrency: number | "auto";
    quiet: boolean;
    verbose?: boolean;
    manifestOnly: boolean;
    curation: boolean;
    skipFaces?: boolean;
    skipEmbeddings?: boolean;
  },
  toProcess: string[],
  cache: Cache,
  previousEntries: Map<string, ImageEntry>,
  opts: {
    allowUpscale?: boolean;
    formats?: ImageFormat[];
    qualityOverrides?: Record<string, number>;
  },
  processImageFn = processImage,
): Promise<ProcessedImageResult[]> {
  return processImages(
    toProcess,
    {
      concurrency: ARGS.concurrency,
      quiet: ARGS.quiet,
      verbose: ARGS.verbose,
      manifestOnly: ARGS.manifestOnly,
      curation: ARGS.curation,
      skipFaces: ARGS.skipFaces,
      skipEmbeddings: ARGS.skipEmbeddings,
      srcRoot: CTX.srcRoot,
      outRoot: CTX.outRoot,
      allowUpscale: opts.allowUpscale ?? false,
      formats: opts.formats ?? [...config.encoding.formats],
      qualityOverrides: opts.qualityOverrides ?? {},
      previousEntriesMap: previousEntries,
      oldCache: cache,
    },
    processImageFn,
  );
}

export async function runIncrementalBuild(
  CTX: {
    srcRoot: string;
    contentRoot: string;
    outRoot: string;
    manifestPath: string;
    cachePath: string;
    generatorManifestPath: string;
    menuManifestPath: string;
    siteManifestPath: string;
    shouldWriteSiteManifests: boolean;
    configHash: string;
  },
  ARGS: {
    concurrency: number | "auto";
    manifestOnly: boolean;
    curation: boolean;
    quiet: boolean;
    verbose?: boolean;
    limit: number | 0;
    skipFaces?: boolean;
    skipEmbeddings?: boolean;
    detectRenames?: boolean;
    filter?: string;
    force: boolean;
  },
  opts: {
    allowUpscale?: boolean;
    formats?: ImageFormat[];
    qualityOverrides?: Record<string, number>;
    cacheVersion?: number;
  } = {},
  dependencies = { storyLoader: loadStoryData, processImageFn: processImage },
) {
  const startTime = performance.now();
  const gallery = path.basename(path.dirname(CTX.manifestPath));
  logger.info({ gallery }, "Starting incremental build...");

  const {
    cache,
    wasReset,
    storyData,
    previousEntries,
    analysisManifest,
    embeddingsManifest,
    facesManifest,
  } = await loadBuildResourceState(
    CTX,
    opts.cacheVersion ?? 1,
    dependencies.storyLoader,
    ARGS.manifestOnly,
  );

  const { sourceFiles, toProcess, toDelete } = await planBuildWork(
    CTX,
    ARGS,
    cache,
    previousEntries,
    embeddingsManifest,
  );

  const cachedCount = Math.max(0, sourceFiles.length - toProcess.length);
  logger.info(
    { new: toProcess.length, deleted: toDelete.length, cached: cachedCount },
    `Audit results: ${toProcess.length} new, ${toDelete.length} deleted, ${cachedCount} cached`,
  );

  // Rename detection (opt-in)
  if (ARGS.detectRenames && toProcess.length > 0) {
    const cacheDir = path.dirname(CTX.cachePath);
    const contentTracker = await loadContentTracker(cacheDir);
    const renames = await detectRenames(toProcess, contentTracker, CTX.srcRoot);

    if (renames.length > 0) {
      logger.info({ count: renames.length }, "Detected file renames, migrating references...");

      // Load manifests for migration
      const previousManifest = (await loadManifest<Manifest>(CTX.manifestPath)) || {
        photoDays: [],
      };

      for (const rename of renames) {
        // Migrate references in manifests
        migrateReferences(rename, previousManifest, facesManifest, { people: [] });

        // Update cache key
        if (cache.files[rename.oldId]) {
          cache.files[rename.newId] = cache.files[rename.oldId];
          delete cache.files[rename.oldId];
        }

        // Remove from toProcess since we migrated it
        const idx = toProcess.indexOf(path.join(CTX.srcRoot, rename.newPath));
        if (idx !== -1) {
          toProcess.splice(idx, 1);
          logger.verbose({ path: rename.newPath }, "Skipping re-processing of renamed file");
        }
      }

      // Save updated manifest
      await saveImagesManifest(path.dirname(CTX.manifestPath), previousManifest);
    }

    // Update content tracker for future runs
    await updateContentTracker(sourceFiles, contentTracker, CTX.srcRoot);
    await saveContentTracker(cacheDir, contentTracker);
  }

  await pruneDeleted(toDelete, cache, CTX.outRoot);

  const results = await processImages(
    toProcess,
    {
      concurrency: ARGS.concurrency,
      quiet: ARGS.quiet,
      verbose: ARGS.verbose,
      manifestOnly: ARGS.manifestOnly,
      curation: ARGS.curation,
      skipFaces: ARGS.skipFaces,
      skipEmbeddings: ARGS.skipEmbeddings,
      srcRoot: CTX.srcRoot,
      outRoot: CTX.outRoot,
      allowUpscale: opts.allowUpscale ?? false,
      formats: opts.formats ?? [...config.encoding.formats],
      qualityOverrides: opts.qualityOverrides ?? {},
      previousEntriesMap: previousEntries,
      oldCache: cache,
      // Pass specialized manifests
      analysisManifest,
      embeddingsManifest,
      facesManifest,
    },
    dependencies.processImageFn,
  );

  // Use manifest lock to prevent race conditions with API endpoints
  await withManifestLock(path.dirname(CTX.manifestPath), async () => {
    await updateCacheAndManifests({
      cache,
      results,
      toDelete,
      storyData,
      paths: CTX,
      shouldWriteSiteManifests: CTX.shouldWriteSiteManifests,
      configHash: CTX.configHash,
      wasReset,
      outRoot: CTX.outRoot,
    });
  });

  // Aggregate stats per output folder
  type FolderStat = { processed: number; bytes: number };
  const folderStats = new Map<string, FolderStat>();

  for (const res of results) {
    for (const rel of res.outputs) {
      const folder = rel.split(path.sep)[0] || rel;
      const abs = path.join(CTX.outRoot, rel);
      try {
        const st = await stat(abs);
        const current = folderStats.get(folder) || { processed: 0, bytes: 0 };
        current.processed += 1;
        current.bytes += st.size;
        folderStats.set(folder, current);
      } catch {
        // If the output disappeared, count it as processed without size.
        const current = folderStats.get(folder) || { processed: 0, bytes: 0 };
        current.processed += 1;
        folderStats.set(folder, current);
      }
    }
  }

  // Ensure we report even when nothing new was processed
  const expectedFolders = new Set<string>();
  for (const cfg of Object.values(config.outputs)) {
    const folderName = (cfg as { folderName: string }).folderName;
    expectedFolders.add(folderName);
  }
  for (const folder of expectedFolders) {
    if (!folderStats.has(folder)) {
      folderStats.set(folder, { processed: 0, bytes: 0 });
    }
  }

  const failed = Math.max(0, toProcess.length - results.length);
  const totalOutSize = await getDirectorySize(CTX.outRoot);

  const rows: string[] = [];
  const header = ["Folder", "Processed", "Cached", "Failed", "Size"];
  const data = [...folderStats.entries()].map(([folder, stat]) => [
    capitalize(folder),
    String(stat.processed),
    String(cachedCount),
    String(failed),
    formatBytes(stat.bytes),
  ]);

  const totalRow = [
    pc.bold("Total"),
    pc.bold(String(results.length)),
    pc.bold(String(cachedCount)),
    pc.bold(String(failed)),
    pc.bold(formatBytes(totalOutSize)),
  ];

  const widths = header.map((h, idx) =>
    Math.max(visibleLength(h), ...data.map((row) => visibleLength(row[idx]))),
  );

  function formatRow(row: string[]) {
    return row.map((cell, i) => padAnsi(cell, widths[i])).join(" | ");
  }

  rows.push(formatRow(header));
  rows.push(widths.map((w) => "-".repeat(w)).join("-+-"));
  for (const row of data) {
    rows.push(formatRow(row));
  }
  rows.push(widths.map((w) => "-".repeat(w)).join("-+-"));
  rows.push(formatRow(totalRow));

  logger.info(
    {
      processed: results.length,
      cached: cachedCount,
      failed,
      totalSize: totalOutSize,
    },
    `Build statistics:\n${rows.map((row) => `  ${row}`).join("\n")}`,
  );

  const duration = formatDuration(performance.now() - startTime);
  logger.info({ duration }, `Build finished in ${duration}`);
}

async function getDirectorySize(dir: string): Promise<number> {
  let size = 0;

  const files = await scanGlob("**/*", { cwd: dir, absolute: true });
  for (const file of files) {
    const stats = await stat(file);
    size += stats.size;
  }

  return size;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function visibleLength(value: string): number {
  // Strip ANSI escape codes before measuring length for padding
  const ansiPattern = "\\u001B\\[[0-9;]*m";
  const ansiRegex = new RegExp(ansiPattern, "g");
  return value.replace(ansiRegex, "").length;
}

function padAnsi(value: string, width: number): string {
  const len = visibleLength(value);
  if (len >= width) return value;
  return `${value}${" ".repeat(width - len)}`;
}

export default runIncrementalBuild;

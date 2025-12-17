import { SingleBar } from "cli-progress";
import fg from "fast-glob";
import matter from "gray-matter";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Cache, ImageEntry, Manifest, StoryDataMap } from "../../src/lib/types/manifest";
import { config } from "../config";
import { EMBEDDING_DIM } from "./ai-models";
import type { ProcessedImageResult } from "./image-processor";
import { processImage, type ImageProcessOptions } from "./image-processor";
import { createLogger } from "./logger";
import { buildGeneratorManifest, generateMenuManifest, updateManifest } from "./manifest-builder";

import { loadManifest, saveImagesManifest, saveManifest } from "./manifest-repository";

const logger = createLogger("incremental-build");

function ignoreError(_err?: unknown): void {
  // intentionally empty
}

/**
 * Returns false regardless of the input, used for error handling.
 */
function returnFalse(_err?: unknown): boolean {
  return false;
}

/**
 * Checks if a file exists at the given path.
 */
async function fileExists(file: string) {
  try {
    await fsp.access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load Markdown story files from content root and return a map keyed by date or location.
 */
export async function loadStoryData(contentRoot: string): Promise<StoryDataMap> {
  const storyFiles = await fg("**/*.md", {
    cwd: contentRoot,
    absolute: true,
  });
  const storyDataMap: StoryDataMap = {};
  for (const file of storyFiles) {
    try {
      const fileContent = await fsp.readFile(file, "utf8");
      const { data, content } = matter(fileContent);
      const storyBody = (data.content || content).trim();
      const filename = path.basename(file, ".md");
      const locationKey =
        data.location ||
        (data.date ? new Date(data.date).toISOString().substring(0, 10) : filename);

      storyDataMap[locationKey] = {
        title: data.title || "",
        content: storyBody,
        location: data.location || undefined,
        date: data.date ? new Date(data.date).toISOString().substring(0, 10) : undefined,
      };
    } catch (e: any) {
      logger.warn(`Could not parse story file ${file}: ${e.message}`);
    }
  }
  logger.verbose(`Loaded ${Object.keys(storyDataMap).length} story entries from Markdown.`);
  return storyDataMap;
}

/**
 * Generates the site manifest by parsing site.md.
 */
async function generateSiteManifest(): Promise<any> {
  const siteMdPath = path.resolve(process.cwd(), config.paths.siteSource, "site.md");
  if (!(await fileExists(siteMdPath))) {
    logger.warn(`site.md not found at ${siteMdPath}`);
    return {};
  }
  try {
    const content = await fsp.readFile(siteMdPath, "utf8");
    const { data } = matter(content);
    return data;
  } catch (e: any) {
    logger.error(`Failed to parse site.md: ${e.message}`);
    return {};
  }
}

/**
 * Detects changes between source files and the cache, identifying files to process or delete.
 */
async function detectChanges(
  sourceFiles: string[],
  cache: Cache,
  srcRoot: string,
  outRoot: string,
  manifestOnly: boolean,
  previousEntries: Map<string, ImageEntry>,
  isCuration: boolean,
) {
  const toProcess: string[] = [];
  const knownKeys = new Set(Object.keys(cache.files));

  for (const file of sourceFiles) {
    const key = path.posix.normalize(path.relative(srcRoot, file));
    knownKeys.delete(key);
    const stats = await fsp.stat(file);
    const cached = cache.files[key];
    const baseName = path.basename(file);

    // 1. Check File Change (Time/Hash - implicit via mtime for speed here)
    if (!cached || cached.mtimeMs !== stats.mtimeMs) {
      toProcess.push(file);
      continue;
    }

    // 2. Check Embedding Validity (if curation enabled)
    if (isCuration) {
      const prev = previousEntries.get(baseName);
      if (prev) {
        const embedding = prev.analysis?.embedding;
        if (!embedding || !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
          logger.verbose(`Stale or missing embedding for ${key}, forcing re-process.`);
          toProcess.push(file);
          continue;
        }
      }
    }

    // 3. Check Output Files
    if (!manifestOnly) {
      const outputsExist = await Promise.all(
        cached.outputs.map((p) => fileExists(path.join(outRoot, p)).catch(returnFalse)),
      );

      if (outputsExist.some((exists) => !exists)) {
        logger.verbose(`Output file missing for ${key}, reprocessing.`);
        toProcess.push(file);
      }
    }
  }
  return { toProcess, toDelete: Array.from(knownKeys) };
}

/**
 * Loads the build cache, resetting it if configuration or cache version changes.
 */
async function loadCache(
  cachePath: string,
  configHash: string,
  outRoot: string,
  cacheVersion: number,
) {
  const cache = (await loadManifest<Cache>(cachePath)) || {
    version: cacheVersion,
    configHash: "",
    files: {},
  };

  let wasReset = false;
  if (cache.configHash !== configHash || cache.version !== cacheVersion) {
    logger.warn("Config, cache version, or script change detected. Forcing full rebuild.");
    await fsp.rm(outRoot, { recursive: true, force: true }).catch(ignoreError);
    // Return empty cache
    return {
      cache: { version: cacheVersion, configHash, files: {} },
      wasReset: true,
    };
  }
  return { cache, wasReset };
}

/**
 * Finds all source image files within the given source root, respecting a limit if provided.
 */
async function findSourceFiles(srcRoot: string, limit: number | 0) {
  const inputExts = config.script.inputExtensions;
  const sourceFiles = await fg(`**/*.{${inputExts.join(",")}}`, {
    cwd: srcRoot,
    absolute: true,
    dot: false,
    onlyFiles: true,
    // Ignore hidden and helper subfolders inside pics (e.g., archive, _stash, _schovane, .git)
    ignore: ["**/.git/**", "**/archive/**", "**/_*/**"],
  });
  if (limit > 0) sourceFiles.splice(limit);
  return sourceFiles;
}

/**
 * Removes deleted files from the cache and deletes their corresponding output files.
 */
async function pruneDeleted(toDelete: string[], cache: Cache, outRoot: string) {
  if (toDelete.length === 0) return;

  const deleteKey = async (key: string) => {
    const outputs = cache.files[key]?.outputs || [];
    delete cache.files[key];
    await Promise.all(outputs.map((p) => fsp.unlink(path.join(outRoot, p)).catch(ignoreError)));
  };

  await Promise.all(toDelete.map(deleteKey));
}

/**
 * Process a list of image files concurrently and return their processed results.
 */
async function processImages(
  toProcess: string[],
  {
    concurrency,
    quiet,
    ...options
  }: {
    concurrency: number | "auto";
    quiet: boolean;
    previousEntriesMap?: Map<string, ImageEntry>;
    oldCache?: Cache;
  } & ImageProcessOptions,
  processImageFn = processImage, // Dependency Injection default
): Promise<ProcessedImageResult[]> {
  if (toProcess.length === 0) return [];

  const resolvedConcurrency =
    typeof concurrency === "number" ? concurrency : Math.max(1, (os.cpus()?.length || 2) - 1);
  logger.info(`Using concurrency: ${resolvedConcurrency}`);

  const bar = quiet
    ? null
    : new SingleBar({
        format: "Processing [{bar}] {percentage}% | {value}/{total}",
      });
  bar?.start(toProcess.length, 0);

  const results: ProcessedImageResult[] = [];
  let index = 0;

  const workerLoop = async () => {
    while (index < toProcess.length) {
      const pos = index++;
      if (pos >= toProcess.length) break;
      const filePath = toProcess[pos];
      const key = path.posix.normalize(path.relative(options.srcRoot, filePath));
      const oldHash = (options as any).oldCache?.files?.[key]?.hash;
      const baseName = path.basename(filePath);
      const previousEntry = (options as any).previousEntriesMap?.get(baseName);

      const res = await processImageFn(filePath, { ...options, oldHash, previousEntry });
      if (res) results.push(res);
      bar?.increment();
    }
  };

  const pool = Array.from({ length: resolvedConcurrency }, workerLoop);
  await Promise.all(pool);

  bar?.stop();
  return results;
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
  }

  const savePromises = [
    saveManifest(paths.cachePath, cache),
    saveManifest(paths.generatorManifestPath, generatorManifest),
  ];

  if (shouldWriteSiteManifests) {
    savePromises.push(saveImagesManifest(path.dirname(paths.manifestPath), finalManifest)); // Using wrapper requires dir, or generic?
    // Wrapper loadImagesManifest takes outRoot. Let's stick to generic saveManifest for absolute paths if wrappers assume a specific structure we might not fully adhere to in 'paths' object.
    // Actually, paths.manifestPath is typically .../images.manifest.json.
    // Let's use generic saveManifest for maximum flexibility here as 'paths' are explicit.

    // override the push above to use generic saveManifest for consistency
    // savePromises.push(saveManifest(paths.manifestPath, finalManifest));

    const menuManifest = generateMenuManifest(finalManifest);
    savePromises.push(saveManifest(paths.menuManifestPath, menuManifest));

    const siteManifest = await generateSiteManifest();
    savePromises.push(saveManifest(paths.siteManifestPath, siteManifest));
  }

  await Promise.all(savePromises);
}

/**
 * Run an incremental site build: detect changes, process images and update manifests.
 */
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
    limit: number | 0;
  },
  opts: {
    allowUpscale?: boolean;
    formats?: any[];
    qualityOverrides?: Record<string, number>;
    cacheVersion?: number;
  } = {},
  dependencies = { storyLoader: loadStoryData, processImageFn: processImage }, // Dependency Injection
) {
  const startTime = performance.now();
  logger.info("Starting incremental build...");
  if (ARGS.manifestOnly) {
    logger.info("Manifest-only mode enabled.");
  }

  const { cache, wasReset } = await loadCache(
    CTX.cachePath,
    CTX.configHash,
    CTX.outRoot,
    opts.cacheVersion ?? 1,
  );

  const storyData = await dependencies.storyLoader(CTX.contentRoot);

  const { cache: cacheAfter, wasReset: wasResetAfter } = await loadCache(
    CTX.cachePath,
    CTX.configHash,
    CTX.outRoot,
    opts.cacheVersion ?? 1,
  );

  // 1. Load previous manifest
  const previousManifest: Manifest = (await loadManifest<Manifest>(CTX.manifestPath)) || {
    photoDays: [],
  };

  const previousEntries = new Map<string, ImageEntry>();
  for (const day of previousManifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.src) {
        previousEntries.set(item.src, item);
      }
    }
  }

  const sourceFiles = await findSourceFiles(CTX.srcRoot, ARGS.limit);

  const { toProcess, toDelete } = await detectChanges(
    sourceFiles,
    cacheAfter,
    CTX.srcRoot,
    CTX.outRoot,
    ARGS.manifestOnly,
    previousEntries,
    ARGS.curation,
  );

  logger.info(`Found: ${toProcess.length} new/modified, ${toDelete.length} deleted.`);

  await pruneDeleted(toDelete, cacheAfter, CTX.outRoot);

  const results = await processImages(
    toProcess,
    {
      ...ARGS,
      srcRoot: CTX.srcRoot,
      outRoot: CTX.outRoot,
      allowUpscale: opts.allowUpscale ?? false,
      formats: opts.formats ?? [...config.encoding.formats],
      qualityOverrides: opts.qualityOverrides ?? {},
      previousEntriesMap: previousEntries,
      oldCache: cacheAfter,
    },
    dependencies.processImageFn,
  );

  await updateCacheAndManifests({
    cache: cacheAfter,
    results,
    toDelete,
    storyData,
    paths: {
      cachePath: CTX.cachePath,
      generatorManifestPath: CTX.generatorManifestPath,
      manifestPath: CTX.manifestPath,
      menuManifestPath: CTX.menuManifestPath,
      siteManifestPath: CTX.siteManifestPath,
    },
    shouldWriteSiteManifests: CTX.shouldWriteSiteManifests,
    configHash: CTX.configHash,
    wasReset: wasResetAfter,
  });

  logger.info(`Build finished in ${(performance.now() - startTime).toFixed(2)}ms.`);
}

export default runIncrementalBuild;

import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import fg from "fast-glob";
import { SingleBar } from "cli-progress";
import { config } from "../config";
import type { Manifest, Cache, StoryDataMap } from "../../src/lib/types/manifest";
import { createLogger } from "./logger";
import { ensureDir } from "./image-utils";
import { buildGeneratorManifest, generateMenuManifest, updateManifest } from "./manifest-builder";
import type { ProcessedImageResult } from "./image-processor";
import { processImage, type ImageProcessOptions } from "./image-processor";
import matter from "gray-matter";

const logger = createLogger("images");

function ignoreError(_err?: unknown): void {
  // intentionally empty
}

function returnFalse(_err?: unknown): boolean {
  return false;
}

async function fileExists(file: string) {
  try {
    await fsp.access(file);
    return true;
  } catch {
    return false;
  }
}

async function loadJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const content = await fsp.readFile(file, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function saveJSON(file: string, data: unknown) {
  await ensureDir(path.dirname(file));
  await fsp.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

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
      if (data.location) {
        storyDataMap[data.location] = {
          title: data.title || "",
          content: storyBody,
          location: data.location,
        };
      } else if (data.date) {
        // ... handled below
      } else {
        // Fallback: use filename as location key
        storyDataMap[filename] = {
          title: data.title || "",
          content: storyBody,
          location: filename,
        };
      }

      if (data.date) {
        const dateStr =
          data.date instanceof Date
            ? data.date.toISOString().substring(0, 10)
            : String(data.date).substring(0, 10);
        storyDataMap[dateStr] = {
          title: data.title || "",
          content: storyBody,
          date: dateStr,
        };
      }
    } catch (e: any) {
      logger.warn(`Could not parse story file ${file}: ${e.message}`);
    }
  }
  logger.verbose(`Loaded ${Object.keys(storyDataMap).length} story entries from Markdown.`);
  return storyDataMap;
}

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

async function detectChanges(
  sourceFiles: string[],
  cache: Cache,
  srcRoot: string,
  outRoot: string,
) {
  const toProcess: string[] = [];
  const knownKeys = new Set(Object.keys(cache.files));

  for (const file of sourceFiles) {
    const key = path.posix.normalize(path.relative(srcRoot, file));
    knownKeys.delete(key);
    const stats = await fsp.stat(file);
    const cached = cache.files[key];

    if (!cached || cached.mtimeMs !== stats.mtimeMs) {
      toProcess.push(file);
      continue;
    }

    const outputsExist = await Promise.all(
      cached.outputs.map((p) => fileExists(path.join(outRoot, p)).catch(returnFalse)),
    );

    if (outputsExist.some((exists) => !exists)) {
      logger.verbose(`Output file missing for ${key}, reprocessing.`);
      toProcess.push(file);
    }
  }
  return { toProcess, toDelete: Array.from(knownKeys) };
}

async function loadCache(
  cachePath: string,
  configHash: string,
  outRoot: string,
  cacheVersion: number,
) {
  let cache: Cache = await loadJSON(cachePath, {
    version: cacheVersion,
    configHash: "",
    files: {},
  });

  let wasReset = false;
  if (cache.configHash !== configHash || cache.version !== cacheVersion) {
    logger.warn("Config, cache version, or script change detected. Forcing full rebuild.");
    await fsp.rm(outRoot, { recursive: true, force: true }).catch(ignoreError);
    cache = { version: cacheVersion, configHash, files: {} };
    wasReset = true;
  }
  return { cache, wasReset };
}

async function findSourceFiles(srcRoot: string, limit: number | 0) {
  const inputExts = config.script.inputExtensions;
  const sourceFiles = await fg(`**/*.{${inputExts.join(",")}}`, {
    cwd: srcRoot,
    absolute: true,
    dot: false,
  });
  if (limit > 0) sourceFiles.splice(limit);
  return sourceFiles;
}

async function pruneDeleted(toDelete: string[], cache: Cache, outRoot: string) {
  if (toDelete.length === 0) return;

  const deleteKey = async (key: string) => {
    const outputs = cache.files[key]?.outputs || [];
    delete cache.files[key];
    await Promise.all(outputs.map((p) => fsp.unlink(path.join(outRoot, p)).catch(ignoreError)));
  };

  await Promise.all(toDelete.map(deleteKey));
}

async function processImages(
  toProcess: string[],
  {
    concurrency,
    quiet,
    ...options
  }: { concurrency: number | "auto"; quiet: boolean } & ImageProcessOptions,
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
      // eslint-disable-next-line no-await-in-loop
      const res = await processImage(toProcess[pos], options);
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
  srcRoot,
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
  srcRoot: string;
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
    // If we reset the cache/build, we should ALSO start with a fresh manifest
    // to avoid keeping entries from a previous configuration (e.g. different CONTENT_DIR).
    const existingManifest = wasReset
      ? { photoDays: [] }
      : await loadJSON(paths.manifestPath, {
          photoDays: [],
        });
    finalManifest = updateManifest(results, toDelete, storyData, existingManifest);
  }

  const savePromises = [
    saveJSON(paths.cachePath, cache),
    saveJSON(paths.generatorManifestPath, generatorManifest),
  ];

  if (shouldWriteSiteManifests) {
    savePromises.push(saveJSON(paths.manifestPath, finalManifest));
    const menuManifest = generateMenuManifest(finalManifest);
    savePromises.push(saveJSON(paths.menuManifestPath, menuManifest));

    // Generate site manifest
    const siteManifest = await generateSiteManifest();
    savePromises.push(saveJSON(paths.siteManifestPath, siteManifest));
  }

  await Promise.all(savePromises);
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
    limit: number | 0;
  },
  opts: {
    allowUpscale?: boolean;
    formats?: any[];
    qualityOverrides?: Record<string, number>;
    cacheVersion?: number;
  } = {},
  storyLoader = loadStoryData,
) {
  const startTime = performance.now();
  logger.info("Starting incremental build...");
  if (ARGS.manifestOnly) {
    logger.info(
      "Manifest-only mode enabled. Skipping image processing, generating manifests only.",
    );
  }

  const { cache, wasReset } = await loadCache(
    CTX.cachePath,
    CTX.configHash,
    CTX.outRoot,
    opts.cacheVersion ?? 1,
  );

  const storyData = await storyLoader(CTX.contentRoot);

  // In manifest-only mode, we still want to detect changes (metadata updates)
  // and run processImages (which skips encoding but reads metadata).
  // So we REMOVE the early return block that was here.

  const { cache: cacheAfter, wasReset: wasResetAfter } = await loadCache(
    CTX.cachePath,
    CTX.configHash,
    CTX.outRoot,
    opts.cacheVersion ?? 1,
  );

  const sourceFiles = await findSourceFiles(CTX.srcRoot, ARGS.limit);

  const { toProcess, toDelete } = await detectChanges(
    sourceFiles,
    cacheAfter,
    CTX.srcRoot,
    CTX.outRoot,
  );

  logger.info(`Found: ${toProcess.length} new/modified, ${toDelete.length} deleted.`);

  await pruneDeleted(toDelete, cacheAfter, CTX.outRoot);

  const results = await processImages(toProcess, {
    ...ARGS,
    srcRoot: CTX.srcRoot,
    outRoot: CTX.outRoot,
    allowUpscale: opts.allowUpscale ?? false,
    formats: opts.formats ?? [...config.encoding.formats],
    qualityOverrides: opts.qualityOverrides ?? {},
  });

  // Always update manifest, even if results (processed images) are empty.
  // This allows metadata-only updates (like author/geo changes) to be reflected in manifests
  // without needing to re-process the images themselves.
  await updateCacheAndManifests({
    cache: cacheAfter,
    results, // Can be empty if no images changed
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
    srcRoot: CTX.srcRoot,
  });

  logger.info(`Build finished in ${(performance.now() - startTime).toFixed(2)}ms.`);
}

export default runIncrementalBuild;

import fsp from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import pc from "picocolors";
import type { Cache, ImageEntry, Manifest, StoryDataMap } from "../../../src/lib/types/manifest";
import { config } from "../../build.config";
import { EMBEDDING_DIM } from "../ai/models";
import { createLogger } from "../core/cli-logger";
import { getConcurrency } from "../core/concurrency-utils";
import { createBar, stopAllBars } from "../core/progress-manager";
import type { ProcessedImageResult } from "../image/processor";
import { type ImageProcessOptions, processImage } from "../image/processor";
import { formatDuration } from "../utils/time";
import { buildGeneratorManifest, generateMenuManifest, updateManifest } from "./builder";
// Repository Imports
import {
  loadAnalysisManifest,
  loadEmbeddingsManifest,
  loadFacesManifest,
  loadManifest,
  saveImagesManifest,
  saveManifest,
} from "./repository";

const logger = createLogger("incremental-build");

function _ignoreError(_err?: unknown): void {
  // intentionally empty
}

function _returnFalse(_err?: unknown): boolean {
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

export async function loadStoryData(contentRoot: string): Promise<StoryDataMap> {
  const glob = new Bun.Glob("**/*.md");
  const storyFiles: string[] = [];
  for await (const file of glob.scan({ cwd: contentRoot, absolute: true })) {
    storyFiles.push(file);
  }
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
  manifestOnly: boolean,
  previousEntries: Map<string, ImageEntry>,
  isCuration: boolean,
  embeddingsManifest?: Record<string, number[]>,
) {
  const toProcess: string[] = [];
  const knownKeys = new Set(Object.keys(cache.files));

  for (const file of sourceFiles) {
    const key = path.posix.normalize(path.relative(srcRoot, file));
    knownKeys.delete(key);
    const stats = await fsp.stat(file);
    const cached = cache.files[key];
    const baseName = path.basename(file);

    if (!cached || cached.mtimeMs !== stats.mtimeMs || !previousEntries.has(baseName)) {
      if (!cached || cached.mtimeMs !== stats.mtimeMs) {
        // Changed or new
      } else {
        logger.verbose(
          `Image ${key} is in cache but missing from manifest. Forcing re-process to restore metadata.`,
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
          logger.verbose(`Stale or missing embedding for ${key}, forcing re-process.`);
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
        logger.verbose(`Output file missing for ${key}, reprocessing.`);
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
) {
  const cache = (await loadManifest<Cache>(cachePath)) || {
    version: cacheVersion,
    configHash: "",
    files: {},
  };

  const wasReset = false;
  if (cache.configHash !== configHash || cache.version !== cacheVersion) {
    logger.warn("Config, cache version, or script change detected. Forcing full rebuild.");
    try {
      await fsp.rm(outRoot, { recursive: true, force: true });
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
  const glob = new Bun.Glob(`**/*.{${inputExts.join(",")}}`);
  const sourceFiles: string[] = [];
  for await (const file of glob.scan({ cwd: srcRoot, absolute: true, dot: false })) {
    sourceFiles.push(file);
  }
  if (limit > 0) sourceFiles.splice(limit);
  return sourceFiles;
}

function buildOutputFilePath(outRoot: string, relativePath: string) {
  return path.join(outRoot, relativePath);
}

async function unlinkOutputFile(outRoot: string, relativePath: string): Promise<void> {
  try {
    await fsp.unlink(buildOutputFilePath(outRoot, relativePath));
  } catch {}
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
  logger.info(`Using concurrency: ${resolvedConcurrency}`);

  const bar = quiet ? null : createBar(toProcess.length, "[images]", { suffix: "| Processing" });

  // bar?.start(toProcess.length, 0); // createBar already initializes

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

  if (bar) {
    bar.stop();
    stopAllBars();
  }

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
    savePromises.push(saveImagesManifest(path.dirname(paths.manifestPath), finalManifest));

    const menuManifest = generateMenuManifest(finalManifest);
    savePromises.push(saveManifest(paths.menuManifestPath, menuManifest));

    const siteManifest = await generateSiteManifest();
    savePromises.push(saveManifest(paths.siteManifestPath, siteManifest));
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
) {
  const { cache, wasReset } = await loadCache(
    CTX.cachePath,
    CTX.configHash,
    CTX.outRoot,
    cacheVersion,
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

  const analysisManifest = (await loadAnalysisManifest(CTX.outRoot)) || {};
  const embeddingsManifest = (await loadEmbeddingsManifest(CTX.outRoot)) || {};
  const facesManifest = (await loadFacesManifest(CTX.outRoot)) || {};

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

async function planBuildWork(
  CTX: { srcRoot: string; outRoot: string },
  ARGS: { limit: number; manifestOnly: boolean; curation: boolean },
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
  );

  return { sourceFiles, ...audit };
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
  opts: { allowUpscale?: boolean; formats?: any[]; qualityOverrides?: Record<string, number> },
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
  },
  opts: {
    allowUpscale?: boolean;
    formats?: any[];
    qualityOverrides?: Record<string, number>;
    cacheVersion?: number;
  } = {},
  dependencies = { storyLoader: loadStoryData, processImageFn: processImage },
) {
  const startTime = performance.now();
  logger.info("Starting incremental build...");

  const {
    cache,
    wasReset,
    storyData,
    previousEntries,
    analysisManifest,
    embeddingsManifest,
    facesManifest,
  } = await loadBuildResourceState(CTX, opts.cacheVersion ?? 1, dependencies.storyLoader);

  const { sourceFiles, toProcess, toDelete } = await planBuildWork(
    CTX,
    ARGS,
    cache,
    previousEntries,
    embeddingsManifest,
  );

  const cachedCount = Math.max(0, sourceFiles.length - toProcess.length);
  logger.info(
    `Found: ${toProcess.length} new/modified, ${toDelete.length} deleted, ${cachedCount} cached.`,
  );

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

  await updateCacheAndManifests({
    cache,
    results,
    toDelete,
    storyData,
    paths: CTX,
    shouldWriteSiteManifests: CTX.shouldWriteSiteManifests,
    configHash: CTX.configHash,
    wasReset,
  });

  // Aggregate stats per output folder
  type FolderStat = { processed: number; bytes: number };
  const folderStats = new Map<string, FolderStat>();

  for (const res of results) {
    for (const rel of res.outputs) {
      const folder = rel.split(path.sep)[0] || rel;
      const abs = path.join(CTX.outRoot, rel);
      try {
        const st = await fsp.stat(abs);
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
    const folderName = (cfg as any).folderName;
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

  logger.info(`\n${rows.join("\n")}`);

  logger.info(`Build finished in ${formatDuration(performance.now() - startTime)}.`);
}

async function getDirectorySize(dir: string): Promise<number> {
  let total = 0;
  const glob = new Bun.Glob("**/*");
  for await (const file of glob.scan({ cwd: dir, absolute: true, dot: false })) {
    try {
      const st = await fsp.stat(file);
      if (st.isFile()) total += st.size;
    } catch {
      // ignore
    }
  }
  return total;
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

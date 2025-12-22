process.env.GLIB_LOG_LEVEL = "critical";

import fsp from "node:fs/promises";
import path from "node:path";
import { intro, select } from "@clack/prompts";
import pc from "picocolors";
import "sharp";
import type { QualityTypes, ScriptArgs } from "../src/lib/types/manifest";
import { config } from "./config";
import { runBlurBuild } from "./lib/blur-processor";
import { type CliOptions, parseCliArguments } from "./lib/cli-parser";
import { getConcurrency } from "./lib/concurrency-utils";
import { cleanup } from "./lib/image-processor";
import { sha1 } from "./lib/image-utils";
import incrementalRun from "./lib/incremental-build";
import { createLogger } from "./lib/logger";
import { formatDuration } from "./lib/time-utils";

let RUNTIME_RAW: Partial<CliOptions> = {};
let RUNTIME_FORMATS = [...config.encoding.formats];
let RUNTIME_QUALITY_OVERRIDES: Partial<Record<QualityTypes, number>> = {};
let RUNTIME_ALLOW_UPSCALE = false;

const CACHE_VERSION = 17;

let parsed = parseCliArguments(process.argv.slice(2));

type ExtendedScriptArgs = ScriptArgs & { __raw: CliOptions };

let ARGS: ExtendedScriptArgs = {
  concurrency: parsed.concurrency,
  limit: parsed.limit,
  watch: parsed.watch,
  clean: parsed.clean,
  verbose: parsed.verbose,
  quiet: parsed.quiet,
  manifestOnly: parsed.manifestOnly ?? false,
  curation: parsed.curation ?? false,
  skipFaces: parsed.skipFaces ?? false,
  skipEmbeddings: parsed.skipEmbeddings ?? false,
  __raw: parsed,
};

let logger = createLogger("images");
if (ARGS.quiet || (ARGS.manifestOnly && !ARGS.verbose)) logger.silent = true;
if (ARGS.verbose) logger.level = "verbose";

// Context
let contentDir = process.env.CONTENT_DIR;
function isSrcArgFlag(a: string) {
  return a.startsWith("--src=") || a.startsWith("--blur.src=");
}
let hasSrcArg = process.argv.slice(2).some(isSrcArgFlag);

export function resetCliState() {
  parsed = parseCliArguments(process.argv.slice(2));
  ARGS = {
    concurrency: parsed.concurrency,
    limit: parsed.limit,
    watch: parsed.watch,
    clean: parsed.clean,
    verbose: parsed.verbose,
    quiet: parsed.quiet,
    manifestOnly: parsed.manifestOnly ?? false,
    curation: parsed.curation ?? false,
    skipFaces: parsed.skipFaces ?? false,
    skipEmbeddings: parsed.skipEmbeddings ?? false,
    __raw: parsed,
  };
  RUNTIME_RAW = {};
  RUNTIME_FORMATS = [...config.encoding.formats];
  RUNTIME_QUALITY_OVERRIDES = {};
  RUNTIME_ALLOW_UPSCALE = false;
  logger = createLogger("images");
  if (ARGS.quiet || (ARGS.manifestOnly && !ARGS.verbose)) logger.silent = true;
  if (ARGS.verbose) logger.level = "verbose";
  contentDir = process.env.CONTENT_DIR;
  hasSrcArg = process.argv.slice(2).some(isSrcArgFlag);
  CTX = initializeContext();
}

async function getGalleryOrPrompt(): Promise<string> {
  const envDir = process.env.CONTENT_DIR;
  if (envDir) return envDir;

  const contentDirRoot = path.resolve("content");
  const entries = await fsp.readdir(contentDirRoot, { withFileTypes: true });
  const galleries = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (galleries.length === 0) {
    throw new Error("No galleries found in content/ directory.");
  }

  if (galleries.length === 1) {
    return galleries[0];
  }

  const galleryId = await select({
    message: "Select a gallery to process:",
    options: galleries.map((g) => ({ value: g, label: g })),
  });

  if (typeof galleryId !== "string") {
    process.exit(0);
  }
  return galleryId;
}

function initializeContext() {
  const raw = ARGS.__raw;
  const defaultManifestPath = path.resolve(process.cwd(), config.paths.manifest);
  const overrideManifestPath = raw?.manifest ? path.resolve(process.cwd(), raw.manifest) : null;
  return {
    srcRoot: raw?.src
      ? path.resolve(process.cwd(), raw.src)
      : path.resolve(process.cwd(), config.paths.source),
    contentRoot: path.resolve(process.cwd(), "content"),
    outRoot: raw?.out
      ? path.resolve(process.cwd(), raw.out)
      : path.resolve(process.cwd(), config.paths.output),
    manifestPath: defaultManifestPath,
    cachePath: raw?.cache
      ? path.resolve(process.cwd(), raw.cache)
      : path.resolve(process.cwd(), config.paths.cache),
    generatorManifestPath: path.resolve(
      process.cwd(),
      overrideManifestPath ?? path.join(config.paths.tmp, "generator.manifest.json"),
    ),
    menuManifestPath: path.resolve(process.cwd(), config.paths.dataRoot, "menu.manifest.json"),
    siteManifestPath: path.resolve(process.cwd(), config.paths.siteManifest),
    shouldWriteSiteManifests: !overrideManifestPath || overrideManifestPath === defaultManifestPath,
    configHash: sha1(Buffer.from(JSON.stringify(config))),
  };
}

let CTX = initializeContext();

function logOutputPlan() {
  const relSrc = path.posix.normalize(path.relative(process.cwd(), CTX.srcRoot));
  const relOut = path.posix.normalize(path.relative(process.cwd(), CTX.outRoot));
  logger.info(`Source: ${relSrc}`);
  logger.info(`Output root: ${relOut}`);

  const outputs = config.outputs as Record<
    keyof typeof config.outputs,
    (typeof config.outputs)[keyof typeof config.outputs]
  >;
  Object.entries(outputs).forEach(([key, cfg]) => {
    const resize = (cfg as any).resize || {};
    const width = resize.width ? `${resize.width}` : "auto";
    const height = resize.height ? `${resize.height}` : "auto";
    const crop = resize.crop ? " crop" : "";
    const format = (cfg as any).format ? ` ${String((cfg as any).format)}` : "";
    const target = path.posix.join(config.paths.output, (cfg as any).folderName);
    logger.info(`${key}: ${width}x${height}${crop}${format} -> ${target}`);
  });
}
async function cleanAllOutputs() {
  await fsp.rm(CTX.outRoot, { recursive: true, force: true });
}

export async function main() {
  const title = ARGS.__raw.title || "🏭 Image Generator";
  if (!ARGS.quiet) {
    if (process.env.LOG_STYLE === "boxed") {
      logger.info(pc.bold(title));
    } else {
      intro(title);
    }
  }

  if (!contentDir && !hasSrcArg) {
    try {
      contentDir = await getGalleryOrPrompt();
      ARGS.__raw.src = path.resolve(process.cwd(), `content/${contentDir}/pics`);
      process.env.CONTENT_DIR = contentDir;
      CTX = initializeContext();
    } catch (e: any) {
      logger.error(e.message);
      process.exit(1);
    }
  }
  logger.verbose(`Processing content for: ${contentDir}`);

  logOutputPlan();

  RUNTIME_RAW = ARGS.__raw || {};
  RUNTIME_FORMATS = RUNTIME_RAW.formats?.length
    ? [...RUNTIME_RAW.formats]
    : [...config.encoding.formats];
  RUNTIME_QUALITY_OVERRIDES = RUNTIME_RAW.quality ?? {};
  RUNTIME_ALLOW_UPSCALE = RUNTIME_RAW.allowUpscale ?? false;

  if (ARGS.clean) await cleanAllOutputs();

  if (ARGS.manifestOnly) {
    logger.info("Manifest-only mode: Skipping image processing and variants generation.");
    return;
  }

  if (RUNTIME_RAW.blurEnable && RUNTIME_RAW.blurOnly) {
    await runBlurBuild(RUNTIME_RAW, getConcurrency(ARGS.concurrency));
    return;
  }

  if (ARGS.watch) {
    logger.info(
      `Watch mode enabled. Watching ${path.posix.normalize(CTX.srcRoot)} and ${path.posix.normalize(CTX.contentRoot)}.`,
    );
    await incrementalRun(CTX, ARGS, {
      allowUpscale: RUNTIME_ALLOW_UPSCALE,
      formats: RUNTIME_FORMATS,
      qualityOverrides: RUNTIME_QUALITY_OVERRIDES,
      cacheVersion: CACHE_VERSION,
    });
  } else {
    await incrementalRun(CTX, ARGS, {
      allowUpscale: RUNTIME_ALLOW_UPSCALE,
      formats: RUNTIME_FORMATS,
      qualityOverrides: RUNTIME_QUALITY_OVERRIDES,
      cacheVersion: CACHE_VERSION,
    });
  }
}

export async function executeMain(): Promise<void> {
  const startTime = performance.now();
  try {
    await main();
  } catch (e) {
    const errAny: any = e;
    logger.error(
      `An unexpected error occurred in the main process. ${errAny?.stack ?? String(errAny)}`,
    );
    process.exit(1);
  } finally {
    await cleanup();
    if (!ARGS.quiet) {
      logger.info(`Total time: ${formatDuration(performance.now() - startTime)}`);
    }
  }
}

if (import.meta.main) {
  executeMain();
}

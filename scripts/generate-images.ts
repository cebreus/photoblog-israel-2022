// Suppress macOS GNotificationCenterDelegate warnings
process.env.GLIB_LOG_LEVEL = "critical";

import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import fg from "fast-glob";
import { config } from "./config";
import type { ScriptArgs, QualityTypes } from "../src/lib/types/manifest";
import { parseCliArguments, type CliOptions } from "./lib/cli-parser";
import { createLogger } from "./lib/logger";

import { processImage, cleanup } from "./lib/image-processor";
import incrementalRun from "./lib/incremental-build";
import { runBlurBuild } from "./lib/blur-processor";
import { sha1 } from "./lib/image-utils";
import { initModels } from "./lib/face-detection";

// Runtime overrides from CLI flags.
let RUNTIME_RAW: Partial<CliOptions> = {};
let RUNTIME_FORMATS = [...config.encoding.formats];
let RUNTIME_QUALITY_OVERRIDES: Partial<Record<QualityTypes, number>> = {};
let RUNTIME_ALLOW_UPSCALE = false;

const CACHE_VERSION = 13;

// CLI parsing - Mutable for testing
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
  __raw: parsed,
};

let logger = createLogger("images");
if (ARGS.quiet) logger.silent = true;
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
    __raw: parsed,
  };
  RUNTIME_RAW = {};
  RUNTIME_FORMATS = [...config.encoding.formats];
  RUNTIME_QUALITY_OVERRIDES = {};
  RUNTIME_ALLOW_UPSCALE = false;
  logger = createLogger("images");
  if (ARGS.quiet) logger.silent = true;
  if (ARGS.verbose) logger.level = "verbose";
  contentDir = process.env.CONTENT_DIR;
  hasSrcArg = process.argv.slice(2).some(isSrcArgFlag);
  CTX = initializeContext();
}

let CTX = initializeContext();

function resolveConcurrency(value: number | "auto") {
  if (value === "auto") {
    return Math.max(1, (os.cpus()?.length || 2) - 1);
  }
  return Math.max(1, value);
}

function isProcessedImageResult(
  r: Awaited<ReturnType<typeof processImage>> | null,
): r is NonNullable<Awaited<ReturnType<typeof processImage>>> {
  return r != null;
}

function initializeContext() {
  const raw = ARGS.__raw;
  const defaultManifestPath = path.resolve(
    process.cwd(),
    config.paths.manifest,
  );
  const overrideManifestPath = raw?.manifest
    ? path.resolve(process.cwd(), raw.manifest)
    : null;
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
      overrideManifestPath ??
        path.join(config.paths.tmp, "generator.manifest.json"),
    ),
    menuManifestPath: path.resolve(
      process.cwd(),
      config.paths.dataRoot,
      "menu.manifest.json",
    ),
    siteManifestPath: path.resolve(process.cwd(), config.paths.siteManifest),
    shouldWriteSiteManifests:
      !overrideManifestPath || overrideManifestPath === defaultManifestPath,
    configHash: sha1(Buffer.from(JSON.stringify(config))),
  };
}

async function cleanAllOutputs() {
  await fsp.rm(CTX.outRoot, { recursive: true, force: true });
}

export async function main() {
  if (!contentDir && !hasSrcArg) {
    logger.error(
      "'CONTENT_DIR' environment variable is not set. Please specify which content to process.",
    );
    process.exit(1);
  }
  logger.verbose(`Processing content for: ${contentDir}`);

  // Initialize face detection models (downloads if missing)
  await initModels();

  // sharp is loaded where it's actually needed by workers (processImage) or blur processor

  RUNTIME_RAW = ARGS.__raw || {};
  RUNTIME_FORMATS =
    RUNTIME_RAW.formats && RUNTIME_RAW.formats.length
      ? [...RUNTIME_RAW.formats]
      : [...config.encoding.formats];
  RUNTIME_QUALITY_OVERRIDES = RUNTIME_RAW.quality ?? {};
  RUNTIME_ALLOW_UPSCALE = RUNTIME_RAW.allowUpscale ?? false;

  if (RUNTIME_RAW.blurEnable && RUNTIME_RAW.blurOnly) {
    await runBlurBuild(RUNTIME_RAW, resolveConcurrency(ARGS.concurrency));
    return;
  }

  if (ARGS.clean) await cleanAllOutputs();

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
  try {
    await main();
  } catch (e) {
    // Ensure the actual error stack or message is visible in the logs — the logger currently
    // prints only the message and ignores metadata objects. Emit the stack explicitly.
    const errAny: any = e;
    logger.error(
      "An unexpected error occurred in the main process. " +
        (errAny?.stack ?? String(errAny)),
    );
    process.exit(1);
  } finally {
    // Ensure ExifTool process is closed so the script can exit
    await cleanup();
  }
}

executeMain();

// Suppress macOS GNotificationCenterDelegate warnings
process.env.GLIB_LOG_LEVEL = "critical";
import { intro, select } from "@clack/prompts";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import "sharp"; // Preload sharp to potentially avoid GNotificationCenterDelegate conflict with canvas
import type { QualityTypes, ScriptArgs } from "../src/lib/types/manifest";
import { config } from "./config";
import { parseCliArguments, type CliOptions } from "./lib/cli-parser";
import { createLogger } from "./lib/logger";

import { runBlurBuild } from "./lib/blur-processor";
import { initModels } from "./lib/face-detection";
import { cleanup, processImage } from "./lib/image-processor";
import { sha1 } from "./lib/image-utils";
import incrementalRun from "./lib/incremental-build";

// Runtime overrides from CLI flags.
let RUNTIME_RAW: Partial<CliOptions> = {};
let RUNTIME_FORMATS = [...config.encoding.formats];
let RUNTIME_QUALITY_OVERRIDES: Partial<Record<QualityTypes, number>> = {};
let RUNTIME_ALLOW_UPSCALE = false;

const CACHE_VERSION = 17;

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
/**
 * Resets the CLI state and re-initializes arguments and context for testing.
 */
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
/**
 * Helper to get content directory from env or prompt user.
 */
async function getGalleryOrPrompt(): Promise<string> {
  const envDir = process.env.CONTENT_DIR;
  if (envDir) return envDir;

  const contentDirRoot = path.resolve("content");
  const entries = await fsp.readdir(contentDirRoot, { withFileTypes: true });
  const galleries = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (galleries.length === 0) {
    throw new Error("No galleries found in content/ directory.");
  }

  // If only one gallery, use it automatically
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

function resolveConcurrency(value: number | "auto") {
  if (value === "auto") {
    return Math.max(1, (os.cpus()?.length || 2) - 1);
  }
  return Math.max(1, value);
}
/**
 * Type guard to check if an image processing result is not null.
 */
function isProcessedImageResult(
  r: Awaited<ReturnType<typeof processImage>> | null,
): r is NonNullable<Awaited<ReturnType<typeof processImage>>> {
  return r != null;
}
/**
 * Initializes the context object with resolved paths and configurations.
 */
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

// Initialize mutable context (can be reset via `resetCliState` in tests)
let CTX = initializeContext();
async function cleanAllOutputs() {
  await fsp.rm(CTX.outRoot, { recursive: true, force: true });
}
export async function main() {
  intro("🏭 Image Generator");

  if (!contentDir && !hasSrcArg) {
    try {
      contentDir = await getGalleryOrPrompt();
      // Update CTX with new contentDir
      ARGS.__raw.src = path.resolve(process.cwd(), `content/${contentDir}/pics`); // rough override
      // Re-init context proper way would be better but simple override for env var effect:
      process.env.CONTENT_DIR = contentDir;
      CTX = initializeContext(); // Re-initialize with new env var
    } catch (e: any) {
      logger.error(e.message);
      process.exit(1);
    }
  }
  logger.verbose(`Processing content for: ${contentDir}`);

  // Initialize face detection models (downloads if missing)
  // Skip if TensorFlow is not available (e.g., native addon not built)
  try {
    await initModels();
  } catch (error) {
    logger.warn("Face detection unavailable (TensorFlow not loaded). Skipping face detection.");
    logger.verbose(`Error: ${error}`);
  }

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
      "An unexpected error occurred in the main process. " + (errAny?.stack ?? String(errAny)),
    );
    process.exit(1);
  } finally {
    // Ensure ExifTool process is closed so the script can exit
    await cleanup();
  }
}

executeMain();

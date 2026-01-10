process.env.GLIB_LOG_LEVEL = "critical";

import { intro } from "@clack/prompts";
import path from "node:path";
import "sharp";
import { clearTaskStatus, saveTaskStatus } from "../src/lib/server/task-status";
import type { QualityTypes, ScriptArgs } from "../src/lib/types/manifest";
import { config } from "./build.config";
import { createLogger } from "$scripts/core/cli-logger";
import { type CliOptions, parseCliArguments } from "$scripts/core/cli-parser";
import { getConcurrency } from "$scripts/core/concurrency-utils";
import { resolveGalleryDirectory } from "$scripts/gallery/resolver";
import { runBlurBuild } from "$scripts/image/blur";
import { cleanup } from "$scripts/image/processor";
import { sha1 } from "$scripts/image/utils";
import incrementalRun from "$scripts/manifests/incremental";
import { getPerformanceRecorder, runWithPerformance } from "$scripts/utils/performance";
import { rm } from "$scripts/utils/runtime";
import { formatDuration } from "$scripts/utils/time";

let RUNTIME_RAW: Partial<CliOptions> = {};
let RUNTIME_FORMATS = [...config.encoding.formats];
let RUNTIME_QUALITY_OVERRIDES: Partial<Record<QualityTypes, number>> = {};
let RUNTIME_ALLOW_UPSCALE = false;

const CACHE_VERSION = 17;

type ExtendedScriptArgs = ScriptArgs & { __raw: CliOptions };

let ARGS: ExtendedScriptArgs;
let logger = createLogger("images");
let contentDir = process.env.CONTENT_DIR;
let CTX: any;

function isSrcArgFlag(a: string) {
  return a.startsWith("--src=") || a.startsWith("--blur.src=");
}
let hasSrcArg = process.argv.slice(2).some(isSrcArgFlag);

export function resetCliState() {
  const parsed = parseCliArguments(process.argv.slice(2));
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
    filter: parsed.filter,
    force: parsed.force ?? false,
    __raw: parsed,
  };

  RUNTIME_RAW = ARGS.__raw;
  contentDir = process.env.CONTENT_DIR;
  RUNTIME_FORMATS = RUNTIME_RAW.formats?.length
    ? [...RUNTIME_RAW.formats]
    : [...config.encoding.formats];
  RUNTIME_QUALITY_OVERRIDES = RUNTIME_RAW.quality ?? {};
  RUNTIME_ALLOW_UPSCALE = RUNTIME_RAW.allowUpscale ?? false;

  logger = createLogger("images");
  if (ARGS.quiet || (ARGS.manifestOnly && !ARGS.verbose)) logger.silent = true;
  if (ARGS.verbose) logger.level = "verbose";

  CTX = initializeContext();
}

function initializeContext() {
  const raw = RUNTIME_RAW;
  const defaultManifestPath = path.resolve(process.cwd(), config.paths.manifest);
  const overrideManifestPath = raw?.manifest ? path.resolve(process.cwd(), raw.manifest) : null;
  return {
    srcRoot: raw?.src
      ? path.resolve(process.cwd(), raw.src)
      : path.resolve(process.cwd(), config.paths.source),
    contentRoot: path.resolve(process.cwd(), config.paths.siteSource),
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

resetCliState();

function logOutputPlan() {
  const relSrc = path.posix.normalize(path.relative(process.cwd(), CTX.srcRoot));
  const relOut = path.posix.normalize(path.relative(process.cwd(), CTX.outRoot));
  logger.debug({ path: relSrc }, "Source directory");
  logger.debug({ path: relOut }, "Output root directory");

  const outputs = config.outputs as Record<
    keyof typeof config.outputs,
    (typeof config.outputs)[keyof typeof config.outputs]
  >;
  Object.entries(outputs).forEach(([key, cfg]) => {
    const resize = (cfg as any).resize || {};
    const width = resize.width ? `${resize.width}` : "auto";
    const height = resize.height ? `${resize.height}` : "auto";
    const target = path.posix.join(config.paths.output, (cfg as any).folderName);
    logger.debug(
      {
        key,
        width,
        height,
        crop: (cfg as any).resize?.crop || false,
        format: (cfg as any).format || "original",
        target,
      },
      `Output variant: ${key}`,
    );
  });
}

async function cleanAllOutputs() {
  await rm(CTX.outRoot, { recursive: true });
}

export async function main() {
  const title = ARGS.__raw.title || "🏭 Image Generator";
  if (!ARGS.quiet) {
    if (process.env.LOG_STYLE === "boxed") {
      logger.info({ op: title }, "Starting generator");
    } else {
      intro(title);
    }
  }

  if (!contentDir && !hasSrcArg) {
    try {
      contentDir = await resolveGalleryDirectory({
        message: "Select a gallery to process:",
      });
      ARGS.__raw.src = path.resolve(process.cwd(), `content/${contentDir}/pics`);
      process.env.CONTENT_DIR = contentDir;
      CTX = initializeContext();
    } catch (e: any) {
      logger.error({ err: e.message }, "Initialization failed");
      process.exit(1);
    }
  }
  logger.verbose({ gallery: contentDir }, "Processing content");

  // Only show output plan when it's relevant
  const isSubprocess = process.env.LOG_STYLE === "boxed";
  const shouldShowPlan =
    !ARGS.quiet && !RUNTIME_RAW.blurOnly && !(ARGS.manifestOnly && isSubprocess);

  if (shouldShowPlan) {
    logOutputPlan();
  }

  if (ARGS.clean && !ARGS.manifestOnly) await cleanAllOutputs();

  if (ARGS.manifestOnly) {
    logger.info({ mode: "manifest-only" }, "Updating manifest metadata only");
  }

  if (RUNTIME_RAW.blurEnable && RUNTIME_RAW.blurOnly) {
    await runBlurBuild(RUNTIME_RAW, getConcurrency(ARGS.concurrency));
    return;
  }

  await incrementalRun(CTX, ARGS, {
    allowUpscale: RUNTIME_ALLOW_UPSCALE,
    formats: RUNTIME_FORMATS,
    qualityOverrides: RUNTIME_QUALITY_OVERRIDES,
    cacheVersion: CACHE_VERSION,
  });
}

export async function executeMain(): Promise<void> {
  await runWithPerformance(async () => {
    const startTime = performance.now();

    // Determine gallery and data directory
    const gallery = ARGS.__raw.gallery || process.env.CONTENT_DIR || "egypt-2025";
    const dataDir = path.resolve(process.cwd(), `src/data/${gallery}`);

    await saveTaskStatus(dataDir, {
      id: "image-processing",
      label: "Generování variant obrázků...",
    });

    try {
      await main();
    } catch (e) {
      const errAny: any = e;
      logger.error(
        { err: errAny?.stack ?? String(errAny) },
        "An unexpected error occurred in the main process",
      );
      process.exit(1);
    } finally {
      await clearTaskStatus(dataDir);
      await cleanup();
      if (!ARGS.quiet) {
        const duration = formatDuration(performance.now() - startTime);

        // Log performance breakdown
        const perf = getPerformanceRecorder()?.getBreakdown();
        if (perf) {
          logger.debug({ perf }, "Performance breakdown");
        }

        logger.info({ duration }, `Job completed in ${duration}`);
      }
    }
  });
}

if (import.meta.main) {
  executeMain();
}

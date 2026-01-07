#!/usr/bin/env bun
process.env.GLIB_LOG_LEVEL = "critical";
process.env.OBJC_DISABLE_INITIALIZE_FORK_SAFETY = "YES";
process.env.LOG_STYLE = "boxed";

import { readdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { cancel, intro, isCancel, outro, select } from "@clack/prompts";
import pc from "picocolors";
import { createLogger } from "./lib/core/cli-logger";
// cleaner.ts consolidated into validator.ts
import { validateAndCleanManifests } from "./lib/manifests/validator";
import { acquireLock, releaseLock } from "./lib/utils/build-lock";
import { run } from "./lib/utils/shell";
import { formatDuration } from "./lib/utils/time";

const DEFAULT_GALLERY = "egypt-2025";
const SCRIPT_DIR = import.meta.dir;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT_ROOT = path.resolve(PROJECT_ROOT, "content");
const logger = createLogger("manage");

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    gallery: {
      type: "string",
      short: "g",
    },
    help: {
      type: "boolean",
      short: "h",
    },
    verbose: {
      type: "boolean",
      short: "v",
    },
    clean: {
      type: "boolean",
    },
    limit: {
      type: "string",
    },
    "manifest-only": {
      type: "boolean",
    },
    curation: {
      type: "boolean",
    },
    "batch-size": {
      type: "string",
    },
    "time-window": {
      type: "string",
    },
    concurrency: {
      type: "string",
    },
    threshold: {
      type: "string",
    },
    "min-confidence": {
      type: "string",
    },
    "min-face-size": {
      type: "string",
    },
    watch: {
      type: "boolean",
    },
    filter: {
      type: "string",
    },
    force: {
      type: "boolean",
    },
  },
  strict: false,
  allowPositionals: true,
});

async function getAvailableGalleries() {
  try {
    const entries = await readdir(CONTENT_ROOT, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !name.startsWith("."));
  } catch (_e: unknown) {
    return [];
  }
}

const command = positionals[0];
const galleryRaw = values.gallery || process.env.CONTENT_DIR;
let gallery = typeof galleryRaw === "string" ? galleryRaw : "";

async function resolveGalleryAndContinue() {
  const galleries = await getAvailableGalleries();

  // 1. If gallery provided, validate it
  if (gallery) {
    if (galleries.includes(gallery)) {
      process.env.CONTENT_DIR = gallery;
      return;
    }
    logger.warn({ gallery }, "Gallery not found in content directory");
  }

  // 2. Fallback to interactive if TTY
  if (process.stdout.isTTY) {
    if (!values.help && command && command !== "clean") {
      const selected = await select({
        message: "Select a gallery to process:",
        options: galleries.map((g: string) => ({ value: g, label: g })),
        initialValue: DEFAULT_GALLERY,
      });

      if (isCancel(selected)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      gallery = selected as string;
      process.stdout.write("\x1B[1A\x1B[2K"); // Clear the default selection line
      logger.raw(`${pc.dim("│")}  ${pc.dim(gallery)}`);
      process.env.CONTENT_DIR = gallery;
      return;
    }
  }

  // 3. Fallback to default
  gallery = DEFAULT_GALLERY;
  process.env.CONTENT_DIR = gallery;
}

function getCommonFlags() {
  const flags: string[] = [];
  if (gallery) flags.push(`--gallery=${gallery}`);
  if (values.verbose) flags.push("--verbose");
  if (values.clean) flags.push("--clean");
  if (values["manifest-only"]) flags.push("--manifest-only");
  if (values.curation) flags.push("--curation");
  if (values.limit) flags.push(`--limit=${values.limit}`);
  if (values["batch-size"]) flags.push(`--batch-size=${values["batch-size"]}`);
  if (values["time-window"]) flags.push(`--time-window=${values["time-window"]}`);
  if (values.concurrency) flags.push(`--concurrency=${values.concurrency}`);
  if (values.threshold) flags.push(`--threshold=${values.threshold}`);
  if (values["min-confidence"]) flags.push(`--minConfidence=${values["min-confidence"]}`);
  if (values["min-face-size"]) flags.push(`--minFaceSize=${values["min-face-size"]}`);
  if (values.watch) flags.push("--watch");
  if (values.filter) flags.push(`--filter=${values.filter}`);
  if (values.force) flags.push("--force");
  return flags;
}

async function checkManifest(isCuration = false) {
  const flags = ["scripts/generate-images.ts", "--manifestOnly", ...getCommonFlags()]; // Include common flags like verbose

  if (isCuration) flags.push("--curation");

  // In curation mode, show progress since it takes longer
  // In non-curation mode, keep it quiet (it's fast anyway)
  if (!values.verbose && !isCuration) flags.push("--quiet");

  flags.push(
    `--title=[MANAGE] Verifying manifest state${isCuration ? " (with curation analysis)" : ""}...`,
  );

  logger.info({ gallery, curation: isCuration }, "Verifying manifest state...");
  await run("bun", flags, {
    env: {
      ...process.env,
      CONTENT_DIR: gallery,
      // In curation mode, allow info logs so user sees progress
      LOG_LEVEL: isCuration ? "info" : "error",
    },
  });
}

async function cmdFavicons() {
  logger.info({ gallery }, "┌ Generating Favicons (Brand Assets)");
  await run("bun", ["scripts/generate-favicons.ts", ...getCommonFlags()]);
}

async function cmdImages() {
  logger.info({ gallery }, "┌ Generating Image Variants (Resizing, Metadata & Blurs)");
  await run("bun", [
    "scripts/generate-images.ts",
    "--title=Image Variants & Metadata",
    "--skipEmbeddings",
    ...getCommonFlags(),
  ]);
}

async function cmdBlur() {
  logger.info({ gallery }, "┌ Generating Blur Placeholders (Manual Override)");
  await run("bun", [
    "scripts/generate-images.ts",
    "--blur.enable=true",
    "--blur.only=true",
    "--title=Blur Hash Generation",
    ...getCommonFlags(),
  ]);
}

async function cmdFaces() {
  logger.info({ gallery }, "┌ Face Clustering & Recognition");
  // ⚠️ Do not switch this back to piped output: face-clustering needs a TTY for cli-progress to render live.
  // Piping/stdout filtering hides carriage returns and causes the "silent progress" regression we fixed.
  await run("bun", ["scripts/face-clustering.ts", ...getCommonFlags()], { stdio: "inherit" });
}

async function cmdCleanup() {
  logger.info({ gallery }, "┌ Running Manifest Integrity Cleanup");
  const dataDir = path.resolve(PROJECT_ROOT, `src/data/${gallery}`);

  // 1. Consolidated Manifest Validation & Cleanup
  // (Includes Phantoms, Stats, and Orphans)
  const result = await validateAndCleanManifests(dataDir);

  if (result.totalCleaned > 0) {
    logger.info({ gallery, cleaned: result.totalCleaned }, "Cleanup completed successfully.");
    if (result.phantomAssignmentsRemoved > 0) {
      logger.info(
        { removed: result.phantomAssignmentsRemoved },
        "Removed phantom image assignments.",
      );
    }
    if (result.peopleStatsUpdated > 0) {
      logger.info({ updated: result.peopleStatsUpdated }, "Recalculated people statistics.");
    }
  } else {
    logger.info({ gallery }, "Manifests are consistent and clean.");
  }
}

async function cmdDev() {
  await checkManifest(false);
  await cmdFavicons();
  await run("bun", ["run", "vite", "dev"]);
}

async function cmdBuild() {
  const outputDir = `build-${gallery}`;

  // Acquire lock for the ENTIRE build duration to protect static/ assets
  // from being overwritten by parallel builds
  await acquireLock(gallery);

  try {
    await run("bun", ["scripts/generate-images.ts", ...getCommonFlags()]);
    await cmdFavicons();

    await run("bun", ["run", "vite", "build"], { env: { OUTPUT_DIR: outputDir } });
  } finally {
    // Release lock only after build is complete
    await releaseLock();
  }
}

async function cmdAnalyze() {
  await checkManifest(true);

  await run("bun", ["scripts/analyze-similarity.ts", ...getCommonFlags()]);
}

async function cmdPreview() {
  const outputDir = `build-${gallery}`;

  logger.info({ outputDir }, "Starting preview server");

  await run("bun", ["run", "vite", "preview", "--outDir", outputDir]);
}

async function cmdProcess() {
  const subcommand = positionals[1];

  // If a subcommand is provided, run only that step
  if (subcommand) {
    switch (subcommand) {
      case "favicons":
        return await cmdFavicons();
      case "images":
        return await cmdImages();
      case "blur":
        return await cmdBlur();
      case "analyze":
        return await cmdAnalyze();
      case "faces":
        return await cmdFaces();
      case "cleanup":
        return await cmdCleanup();
      default:
        logger.error({ subcommand }, "Unknown step");
        process.exit(1);
    }
  }

  const startTime = performance.now();

  const isManifestOnly = values["manifest-only"];
  const totalSteps = isManifestOnly ? 2 : 5;

  logger.info({ step: 1, total: totalSteps }, "┌ Step 1: Favicons");
  const t1 = performance.now();
  await cmdFavicons();
  logger.info({ step: 1, duration: formatDuration(performance.now() - t1) }, "Step 1 complete");

  logger.info({ step: 2, total: totalSteps }, "┌ Step 2: Image Variants (including Blurs)");
  const t2 = performance.now();
  await cmdImages();
  logger.info({ step: 2, duration: formatDuration(performance.now() - t2) }, "Step 2 complete");

  if (!isManifestOnly) {
    logger.info({ step: 3, total: 5 }, "┌ Step 3: Similarity & Aesthetic Analysis");
    const t4 = performance.now();
    await cmdAnalyze();
    logger.info({ step: 3, duration: formatDuration(performance.now() - t4) }, "Step 3 complete");

    logger.info({ step: 4, total: 5 }, "┌ Step 4: Face Clustering");
    const t5 = performance.now();
    await cmdFaces();
    logger.info({ step: 4, duration: formatDuration(performance.now() - t5) }, "Step 4 complete");

    // Step 5: Manifest Validation & Integrity (Consolidated)
    logger.info({ step: 5, total: 5 }, "┌ Step 5: Manifest Validation & Integrity");
    const t6 = performance.now();
    const dataDir = path.resolve(PROJECT_ROOT, `src/data/${gallery}`);

    const result = await validateAndCleanManifests(dataDir);

    if (result.totalCleaned > 0) {
      logger.info({ gallery, cleaned: result.totalCleaned }, "Cleaned orphaned/phantom entries");
    }

    logger.info({ step: 5, duration: formatDuration(performance.now() - t6) }, "Step 5 complete");
  } else {
    logger.info(
      { manifestOnly: true },
      "Skipping AI analysis steps (Similarity, Faces, Validation)",
    );
  }

  logger.info(
    { duration: formatDuration(performance.now() - startTime) },
    "Data processing pipeline complete",
  );
}

async function main() {
  const startTime = performance.now();
  if (values.help || !command) {
    const galleries = await getAvailableGalleries();
    const _galleryList = galleries.length > 0 ? galleries.join(", ") : "none found";
    process.stdout.write(`
  Usage: bun scripts/manage.ts [command] [options]

  Commands:
    dev       Start development server
    build     Build for production
    process   Run full data processing pipeline
    analyze   Run similarity analysis (auto-generates embeddings)
    favicons  Generate favicons and brand assets
    images    Generate image variants and basic metadata
    blur      Generate blur placeholders (LQIP)
    faces     Run face clustering and recognition
    cleanup   Clean phantom assignments and orphaned manifest entries
 
  Global Options:
    --gallery, -g      Target gallery directory (default: ${pc.bold(DEFAULT_GALLERY)})
                       Available: ${_galleryList}
    --verbose, -v      Enable verbose logging
    --clean            Clean output directory before processing
    --manifest-only    Only update manifest, skip actual file generation
    --concurrency      Number of parallel tasks (default: auto)
    --help, -h         Show this help

  Processing Options:
    --limit            Limit number of images to process
    --watch            Watch mode for automatic regeneration (images only)
    --curation         Enable curation mode (duplicates detection)

  AI & Analysis Options:
    --batch-size       Batch size for AI processing (default: 8)
    --time-window      Similarity time window in hours (default: 4)
    --threshold        Face similarity threshold (default: 0.6)
    --min-confidence   Minimum face detection confidence (default: 0.5)
    --min-face-size    Minimum face size in pixels to process (default: 0)
      \n`);
    process.exit(0);
  }

  if (command !== "dev") {
    intro("📸 Photoblog Manager");
  }

  await resolveGalleryAndContinue();

  try {
    switch (command) {
      case "dev":
        await cmdDev();
        break;
      case "build":
        await cmdBuild();
        break;
      case "preview":
        await cmdPreview();
        break;
      case "process":
        await cmdProcess();
        break;
      case "analyze":
        await cmdAnalyze();
        break;
      case "favicons":
        await cmdFavicons();
        break;
      case "images":
        await cmdImages();
        break;
      case "blur":
        await cmdBlur();
        break;
      case "faces":
        await cmdFaces();
        break;
      default:
        logger.error({ command }, "Unknown command");
        process.exit(1);
    }

    if (command !== "dev") {
      const duration = performance.now() - startTime;
      outro(`✅ Execution completed in ${formatDuration(duration)}`);
    }
  } catch (error) {
    logger.error({ command, error: (error as Error).message }, "Command execution failed");
    process.exit(1);
  }
}

main();

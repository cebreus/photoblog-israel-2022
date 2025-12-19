#!/usr/bin/env bun
process.env.GLIB_LOG_LEVEL = "critical";
process.env.OBJC_DISABLE_INITIALIZE_FORK_SAFETY = "YES";

import { cancel, intro, isCancel, select } from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { run } from "./lib/shell-utils";
import { formatDuration } from "./lib/time-utils";

const DEFAULT_GALLERY = "egypt-2025";
const SCRIPT_DIR = import.meta.dir;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT_ROOT = path.resolve(PROJECT_ROOT, "content");

const { values, positionals } = parseArgs({
  args: Bun.argv,
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
  },
  strict: false,
  allowPositionals: true,
});

async function getAvailableGalleries() {
  try {
    const entries = await fs.promises.readdir(CONTENT_ROOT, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !name.startsWith("."));
  } catch (_e: unknown) {
    return [];
  }
}

const command = positionals[2];
const galleryRaw = values.gallery || process.env.CONTENT_DIR;
let gallery = typeof galleryRaw === "string" ? galleryRaw : "";

if (!gallery && command && command !== "clean") {
  if (!values.help) {
    if (process.stdout.isTTY) {
      const galleries = await getAvailableGalleries();

      if (galleries.length > 1) {
        intro("📸 Photoblog Manager");
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
      } else if (galleries.length === 1) {
        gallery = galleries[0];
      }
    }
  }
}

gallery = gallery || DEFAULT_GALLERY;
process.env.CONTENT_DIR = gallery;

function log(msg: string, type: "info" | "error" | "warn" | "stage" = "info") {
  const colors = {
    info: "\x1b[36m", // Cyan
    error: "\x1b[31m", // Red
    warn: "\x1b[33m", // Yellow
    stage: "\x1b[35m\x1b[1m", // Bold Magenta
  };

  const reset = "\x1b[0m";
  const prefix = type === "stage" ? "◆" : "[MANAGE]";

  console.log(`${colors[type]}${prefix} ${msg}${reset}`);
}

function getCommonFlags() {
  const flags: string[] = [];
  if (values.verbose) flags.push("--verbose");
  if (values.clean) flags.push("--clean");
  if (values["manifest-only"]) flags.push("--manifest-only");
  if (values.curation) flags.push("--curation");
  if (values.limit) flags.push(`--limit=${values.limit}`);
  if (values["batch-size"]) flags.push(`--batch-size=${values["batch-size"]}`);
  if (values["time-window"]) flags.push(`--time-window=${values["time-window"]}`);
  if (values.concurrency) flags.push(`--concurrency=${values.concurrency}`);
  return flags;
}

async function checkManifest(isCuration = false) {
  const flags = ["scripts/generate-images.ts", "--manifestOnly", ...getCommonFlags()]; // Include common flags like verbose

  if (isCuration) flags.push("--curation");

  // checkManifest is meant to be quiet unless verbose
  if (!values.verbose) flags.push("--quiet");

  flags.push("--title=[MANAGE] Verifying manifest state...");

  log("Verifying manifest state...");

  await run("bun", flags);
}

async function cmdDev() {
  await checkManifest(false);

  await run("bun", ["scripts/generate-favicons.ts"]);

  await run("bun", ["run", "vite", "dev"]);
}

async function cmdBuild() {
  const outputDir = `build-${gallery}`;

  await run("bun", ["scripts/generate-images.ts", ...getCommonFlags()]);

  await run("bun", ["scripts/generate-favicons.ts"]);

  await run("bun", ["run", "vite", "build"], { env: { OUTPUT_DIR: outputDir } });
}

async function cmdAnalyze() {
  await checkManifest(true);

  await run("bun", ["scripts/analyze-similarity.ts", ...getCommonFlags()]);
}

async function cmdPreview() {
  const outputDir = `build-${gallery}`;

  log(`Starting preview for ${outputDir}...`);

  await run("bun", ["run", "vite", "preview", "--outDir", outputDir]);
}

async function cmdProcess() {
  const startTime = performance.now();

  log("Step 1/5: Generating Favicons (Brand Assets)", "stage");
  const t1 = performance.now();
  await run("bun", ["scripts/generate-favicons.ts", ...getCommonFlags()]);
  log(`Step 1 complete in ${formatDuration(performance.now() - t1)}`);

  log("Step 2/5: Generating Image Variants (Resizing & Basic Metadata)", "stage");
  const t2 = performance.now();
  await run("bun", [
    "scripts/generate-images.ts",
    "--title=🏭 Image Variants & Metadata",
    "--skipFaces",
    "--skipEmbeddings",
    ...getCommonFlags(),
  ]);
  log(`Step 2 complete in ${formatDuration(performance.now() - t2)}`);

  log("Step 3/5: Generating Blur Placeholders", "stage");
  const t3 = performance.now();
  await run("bun", [
    "scripts/generate-images.ts",
    "--blur.enable=true",
    "--blur.only=true",
    "--title=✨ Blur Hash Generation",
    ...getCommonFlags(),
  ]);
  log(`Step 3 complete in ${formatDuration(performance.now() - t3)}`);

  log("Step 4/5: Similarity & Aesthetic Analysis", "stage");
  const t4 = performance.now();
  await cmdAnalyze();
  log(`Step 4 complete in ${formatDuration(performance.now() - t4)}`);

  log("Step 5/5: Face Clustering & Recognition", "stage");
  const t5 = performance.now();
  await run("bun", ["scripts/face-clustering.ts", ...getCommonFlags()], {
    filter: (line) => {
      if (line.includes("GNotificationCenterDelegate") && line.includes("implemented in both"))
        return false;
      if (line.includes("lib/libvips-cpp.") && line.includes("libgio-2.0.0.dylib")) return false;
      return true;
    },
  });
  log(`Step 5 complete in ${formatDuration(performance.now() - t5)}`);

  log(
    `Data processing pipeline complete in ${formatDuration(performance.now() - startTime)}!`,
    "stage",
  );
}

async function main() {
  if (values.help || !command) {
    const galleries = await getAvailableGalleries();
    const _galleryList = galleries.length > 0 ? galleries.join(", ") : "none found";
    console.log(`
  Usage: bun scripts/manage.ts [command] [options]

  Commands:
    dev       Start development server
    build     Build for production
    process   Run full data processing pipeline
    analyze   Run similarity analysis (auto-generates embeddings)

  Options:
    --gallery, -g     Target gallery directory (default: ${DEFAULT_GALLERY})
                      Available: ${_galleryList}
    --verbose, -v     Enable verbose logging (and disable progress bars)
    --clean           Clean output directory before processing
    --limit           Limit number of images to process
    --batch-size      Batch size for AI processing (default: 8)
    --time-window     Similarity time window in hours (default: 4)
    --manifest-only   Only update manifest, skip image generation
    --curation        Enable curation mode
    --help, -h        Show this help
      `);
    process.exit(0);
  }

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
      default:
        log(`Unknown command: ${command}`, "error");
        process.exit(1);
    }
  } catch (error) {
    log((error as Error).message, "error");
    process.exit(1);
  }
}

main();

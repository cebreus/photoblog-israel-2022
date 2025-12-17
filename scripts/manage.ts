#!/usr/bin/env bun
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { parseArgs } from "util";

import { cancel, intro, isCancel, select } from "@clack/prompts";

// --- Configuration ---
const DEFAULT_GALLERY = "egypt-2025";
const SCRIPT_DIR = import.meta.dir;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT_ROOT = path.resolve(PROJECT_ROOT, "content");

// --- CLI Parsing ---
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
    // Flags for specific sub-commands
    "manifest-only": {
      type: "boolean",
    },
    curation: {
      type: "boolean",
    },
  },
  strict: false, // Allow extra args to pass through (e.g. to vite)
  allowPositionals: true,
});

/**
 * Retrieves a list of available galleries by reading subdirectories in the content root.
 */
async function getAvailableGalleries() {
  try {
    const entries = await fs.promises.readdir(CONTENT_ROOT, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !name.startsWith("."));
  } catch (e: unknown) {
    return [];
  }
}

/**
 * Executes a shell command with inherited stdio and custom environment variables.
 */
async function run(cmd: string, args: string[], env: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    log(`Running: ${cmd} ${args.join(" ")} (Gallery: ${env.CONTENT_DIR || gallery})`);

    const mergedEnv = { ...process.env, ...env, CONTENT_DIR: gallery as string };

    // Explicitly cast spawn result to avoid complex type issues with Bun/Node types
    const proc = spawn(cmd, args, {
      stdio: "inherit",
      cwd: PROJECT_ROOT,
      env: mergedEnv,
    }) as any;

    proc.on("close", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

const command = positionals[2]; // bun scripts/manage.ts [command]
let gallery = values.gallery || process.env.CONTENT_DIR;

// Interactive selection if not provided
if (!gallery && command && command !== "clean") {
  // Don't prompt for clean or help
  if (!values.help) {
    // Only prompt if run in TTY
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

// Fallback if still empty (e.g. non-interactive or list failed)
gallery = gallery || DEFAULT_GALLERY;

// --- Helpers ---

/**
 * Logs a message to the console with a specific type and color.
 */
function log(msg: string, type: "info" | "error" | "warn" = "info") {
  const colors = {
    info: "\x1b[36m", // Cyan
    error: "\x1b[31m", // Red
    warn: "\x1b[33m", // Yellow
  };

  const reset = "\x1b[0m";

  console.log(`${colors[type]}[MANAGE] ${msg}${reset}`);
}

/**
 * Checks and updates the manifest state, optionally for curation purposes.
 */
async function checkManifest(isCuration = false) {
  // Logic: Always run incremental build in manifestOnly mode to ensure manifest is fresh.

  // fast-glob and mtime checks in incremental-build.ts make this very fast if nothing changed.

  const flags = ["scripts/generate-images.ts", "--manifestOnly"];

  if (isCuration) flags.push("--curation");

  log("Verifying manifest state...");

  await run("bun", flags);
}

// --- Commands ---

/**
 * Starts the development server, ensuring manifests and favicons are generated.
 */
async function cmdDev() {
  // 1. Ensure basic manifest exists
  await checkManifest(false);

  // 2. Generate Favicons (fast enough to run, ensures they exist)
  await run("bun", ["scripts/generate-favicons.ts"]);

  // 3. Start Vite
  // Pass through any extra args?
  await run("bun", ["run", "vite", "dev"]);
}

/**
 * Builds the project for production, including image generation, favicons, and Vite build.
 */
async function cmdBuild() {
  const outputDir = `build-${gallery}`;

  // 1. Full Image Build
  await run("bun", ["scripts/generate-images.ts"]);

  // 2. Favicons
  await run("bun", ["scripts/generate-favicons.ts"]);

  // 3. Vite Build
  await run("bun", ["run", "vite", "build"], { OUTPUT_DIR: outputDir });
}

/**
 * Runs similarity analysis, ensuring curation manifests and embeddings are up to date.
 */
async function cmdAnalyze() {
  // 1. Ensure Curation Manifest (Embeddings) exists and is fresh
  // This will force embedding generation if missing
  await checkManifest(true);

  // 2. Run Analysis
  await run("bun", ["scripts/analyze-similarity.ts"]);
}

/**
 * Starts a local preview server for the built gallery.
 */
async function cmdPreview() {
  const outputDir = `build-${gallery}`;

  log(`Starting preview for ${outputDir}...`);

  await run("bun", ["run", "vite", "preview", "--outDir", outputDir]);
}

/**
 * Runs the full data processing pipeline, including image generation, face clustering, analysis, and favicon generation.
 */
async function cmdProcess() {
  // Full Pipeline

  // 1. Build Images (Standard)
  await run("bun", ["scripts/generate-images.ts"]);

  // 2. Face Clustering
  await run("bun", ["scripts/face-clustering.ts"]);

  // 3. Analysis (includes curation check)
  await cmdAnalyze();

  // 4. Blurred Images (for placeholders/effects if needed separate, but usually handled in build?
  // Checking package.json: 'images:blur' is separate script with flags)
  // "images:blur": "bun scripts/generate-images.ts --blur.enable=true --blur.only=true"
  await run("bun", ["scripts/generate-images.ts", "--blur.enable=true", "--blur.only=true"]);

  // 5. Favicons
  await run("bun", ["scripts/generate-favicons.ts"]);
}

// --- Main Dispatch ---

/**
 * Main entry point for the CLI, parsing commands and dispatching to appropriate functions.
 */
async function main() {
  if (values.help || !command) {
    const galleries = await getAvailableGalleries();
    const galleryList = galleries.length > 0 ? galleries.join(", ") : "none found";

    console.log(`
  Usage: bun scripts/manage.ts [command] [options]

  Commands:
    dev       Start development server
    build     Build for production
    process   Run full data processing pipeline
    analyze   Run similarity analysis (auto-generates embeddings)

  Options:
    --gallery, -g    Target gallery directory (default: ${DEFAULT_GALLERY})
                     Available: ${galleryList}
    --help, -h       Show this help
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

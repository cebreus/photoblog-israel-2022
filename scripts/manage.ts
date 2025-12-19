#!/usr/bin/env bun

import { cancel, intro, isCancel, select } from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { run } from "./lib/shell-utils";

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
    "manifest-only": {
      type: "boolean",
    },
    curation: {
      type: "boolean",
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
let gallery = values.gallery || process.env.CONTENT_DIR;

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

function log(_msg: string, _type: "info" | "error" | "warn" = "info") {
  const _colors = {
    info: "\x1b[36m", // Cyan
    error: "\x1b[31m", // Red
    warn: "\x1b[33m", // Yellow
  };

  const _reset = "\x1b[0m";

  console.log(`${_colors[_type]}[MANAGE] ${_msg}${_reset}`);
}

async function checkManifest(isCuration = false) {
  const flags = ["scripts/generate-images.ts", "--manifestOnly"];

  if (isCuration) flags.push("--curation");

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

  await run("bun", ["scripts/generate-images.ts"]);

  await run("bun", ["scripts/generate-favicons.ts"]);

  await run("bun", ["run", "vite", "build"], { env: { OUTPUT_DIR: outputDir } });
}

async function cmdAnalyze() {
  await checkManifest(true);

  await run("bun", ["scripts/analyze-similarity.ts"]);
}

async function cmdPreview() {
  const outputDir = `build-${gallery}`;

  log(`Starting preview for ${outputDir}...`);

  await run("bun", ["run", "vite", "preview", "--outDir", outputDir]);
}

async function cmdProcess() {
  await run("bun", ["scripts/generate-images.ts"]);

  await cmdAnalyze();

  await run("bun", ["scripts/generate-images.ts", "--blur.enable=true", "--blur.only=true"]);
  await run("bun", ["scripts/generate-images.ts", "--blur.enable=true", "--blur.only=true"]);

  await run("bun", ["scripts/generate-favicons.ts"]);

  await run("bun", ["scripts/face-clustering.ts"]);
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
    --gallery, -g    Target gallery directory (default: ${DEFAULT_GALLERY})
                     Available: ${_galleryList}
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

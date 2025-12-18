import fg from "fast-glob";
import fsp from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import type { CliOptions } from "./cli-parser";
import { ensureDir } from "./image-utils";
import { createLogger } from "./logger";

const logger = createLogger("blur");

function ignoreError(_err?: unknown): void {
  // no-op
}

export async function processBlurImage(file: string, raw: Partial<CliOptions>): Promise<void> {
  const blurOut = raw.blurOut || config.blur.out;
  const width = raw.blurWidth || config.blur.width;
  const colors = raw.blurColors || config.blur.colors;
  const pngCompression = raw.blurPngCompression ?? config.blur.pngCompression;
  const pngQuality = raw.blurPngQuality ?? config.blur.pngQuality;

  try {
    const baseName = path.basename(file, path.extname(file));
    const buf = await fsp.readFile(file);
    const outPath = path.join(blurOut, `${baseName}.png`);
    await ensureDir(path.dirname(outPath));
    const sharpModule = await loadSharp();
    const inst = sharpModule(buf).resize({ width, withoutEnlargement: true });
    await inst
      .png({
        palette: true,
        colors,
        quality: pngQuality,
        compressionLevel: pngCompression,
      })
      .toFile(outPath);
  } catch (err: any) {
    logger.error(`Blur processing failed for ${file}`, {
      error: err?.message ?? err,
    });
  }
}

export async function runBlurBuild(raw: Partial<CliOptions>, concurrency: number): Promise<void> {
  const blurSrc = raw.blurSrc || config.blur.src;
  const blurOut = raw.blurOut || config.blur.out;

  logger.info(`Blur build: src=${blurSrc}, out=${blurOut}, format=png`);

  const sharpModule = await loadSharp();

  const inputExts = config.script.inputExtensions;
  const srcFiles = await fg(`**/*.{${inputExts.join(",")}}`, {
    cwd: blurSrc,
    absolute: true,
    dot: false,
  });

  await ensureDir(blurOut);

  const concurrencyLimit = Math.max(1, concurrency);
  const results: Promise<void>[] = [];
  let index = 0;

  async function work() {
    while (index < srcFiles.length) {
      const current = index;
      index += 1;
      results[current] = processBlurImage(srcFiles[current], raw);
    }
  }

  const runners = Array.from({ length: concurrencyLimit }, work);
  await Promise.all(runners);

  if (raw.blurClean) {
    const existing = await fg("**/*", {
      cwd: blurOut,
      absolute: true,
      dot: false,
    });
    for (const p of existing) {
      const ext = path.extname(p).slice(1).toLowerCase();
      if (ext !== "png") {
        try {
          await fsp.unlink(p);
        } catch {
          // Ignore unlink errors
        }
      }
    }
  }
}

async function loadSharp() {
  const mod: any = await import("sharp");
  return mod.default ?? mod;
}

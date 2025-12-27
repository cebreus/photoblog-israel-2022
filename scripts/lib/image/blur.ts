import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { confirm, isCancel } from "@clack/prompts";
import { config } from "../../build.config";
import { createLogger } from "../core/cli-logger";
import type { CliOptions } from "../core/cli-parser";
import { getConcurrency } from "../core/concurrency-utils";
import { createBar, stopAllBars } from "../core/progress-manager";
import { scanGlob, spawnSync } from "../utils/runtime";
import { ensureDir } from "./utils";

const logger = createLogger("blur");

let sharpSingleton: any = null;
async function loadSharp() {
  if (sharpSingleton) return sharpSingleton;
  const mod: any = await import("sharp");
  sharpSingleton = mod.default ?? mod;
  return sharpSingleton;
}

export type BlurResult = {
  status: "success" | "fail" | "skipped";
  size: number;
};

export async function processBlurImage(
  file: string,
  raw: Partial<CliOptions>,
): Promise<BlurResult> {
  const blurOut = raw.blurOut || config.blur.out;
  const width = raw.blurWidth || config.blur.width;
  const colors = raw.blurColors || config.blur.colors;
  const pngCompression = raw.blurPngCompression ?? config.blur.pngCompression;
  const pngQuality = raw.blurPngQuality ?? config.blur.pngQuality;

  const baseName = path.basename(file, path.extname(file));
  const outPath = path.join(blurOut, `${baseName}.png`);

  let tempPath: string | null = null;
  try {
    // Basic cache check: skip if output exists and is newer than source
    if (!raw.clean && !raw.blurClean) {
      try {
        const [inStat, outStat] = await Promise.all([fsp.stat(file), fsp.stat(outPath)]);
        if (outStat.mtimeMs > inStat.mtimeMs) {
          return { status: "skipped", size: outStat.size };
        }
      } catch {
        // file not found, proceed
      }
    }

    let processingPath = file;

    // HEIC support via vips (consistent with image-processor.ts)
    const ext = path.extname(file).slice(1).toLowerCase();
    if (ext === "heic" || ext === "heif") {
      tempPath = path.join(os.tmpdir(), `blur_tmp_${baseName}.jpg`);
      spawnSync("vips", ["copy", file, tempPath]);
      processingPath = tempPath;
    }

    await ensureDir(path.dirname(outPath));

    const sharpModule = await loadSharp();
    const inst = sharpModule(processingPath).resize({ width, withoutEnlargement: true });
    await inst
      .png({
        palette: true,
        colors,
        quality: pngQuality,
        compressionLevel: pngCompression,
      })
      .toFile(outPath);

    const finalStat = await fsp.stat(outPath);
    return { status: "success", size: finalStat.size };
  } catch (err: any) {
    logger.error(`Blur processing failed for ${file}: ${err?.message ?? err}`);
    return { status: "fail", size: 0 };
  } finally {
    if (tempPath) {
      try {
        await fsp.unlink(tempPath);
      } catch {
        // ignore
      }
    }
  }
}

export async function runBlurBuild(raw: Partial<CliOptions>, concurrency: number): Promise<void> {
  let blurSrc = raw.blurSrc || config.blur.src;
  const blurOut = raw.blurOut || config.blur.out;

  // Validation & Fallback
  try {
    await fsp.access(blurSrc);
  } catch (_e) {
    // Only offer fallback if it's the default optimized path
    if (!raw.blurSrc || raw.blurSrc === config.blur.src) {
      const fallbackSrc = config.paths.source;

      if (process.stdout.isTTY) {
        logger.warn(`Source dir not found: "${blurSrc}"`);
        const useFallback = await confirm({
          message: `Use original images from "${fallbackSrc}" instead?`,
          initialValue: true,
        });

        if (isCancel(useFallback) || !useFallback) {
          logger.info(
            "Operation cancelled by user. Tip: Run 'pnpm process images' first to generate optimized previews.",
          );
          return;
        }
      } else {
        // Non-interactive (CI/Automatic) - keep automatic fallback for robustness
        logger.warn(
          `Optimized previews not found in ${blurSrc}. Falling back to original images in ${fallbackSrc} for blur generation.`,
        );
      }

      blurSrc = fallbackSrc;

      try {
        await fsp.access(blurSrc);
      } catch (_e2) {
        throw new Error(
          `Blur generation failed: Source directory not found. Tried optimized previews (${config.blur.src}) and originals (${config.paths.source}). Please ensure that either 'static/<gallery>/images/previews-xl' exists or 'content/<gallery>/pics' contains source images.`,
        );
      }
    } else {
      throw new Error(
        `Blur generation failed: Provided source directory "${blurSrc}" does not exist.`,
      );
    }
  }

  logger.debug(`Blur build config:
• src: ${blurSrc}
• out: ${blurOut}
• format: png`);

  const _sharpModule = await loadSharp();

  const inputExts = config.script.inputExtensions;
  const srcFiles: string[] = [];
  try {
    const files = await scanGlob(`**/*.{${inputExts.join(",")}}`, {
      cwd: blurSrc,
      absolute: true,
      dot: false,
    });
    srcFiles.push(...files);
  } catch (err: any) {
    throw new Error(`Failed to scan source directory "${blurSrc}": ${err.message}`);
  }

  if (srcFiles.length === 0) {
    logger.warn(`No images found for blur generation in ${blurSrc}.`);
    return;
  }

  await ensureDir(blurOut);

  const concurrencyLimit = getConcurrency(concurrency);
  let index = 0;
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let completedCount = 0;
  let successSize = 0;
  let skipSize = 0;

  const bar = createBar(srcFiles.length, "[blur]", { suffix: "" });

  async function work() {
    while (true) {
      const current = index;
      if (current >= srcFiles.length) break;
      index += 1;

      const result = await processBlurImage(srcFiles[current], raw);
      if (result.status === "success") {
        successCount++;
        successSize += result.size;
      } else if (result.status === "skipped") {
        skipCount++;
        skipSize += result.size;
      } else {
        failCount++;
      }

      completedCount++;
      bar.update(completedCount, {
        suffix: `| Processed: ${successCount} | Cached: ${skipCount} | Failed: ${failCount}`,
      });
    }
  }

  const runners = Array.from({ length: concurrencyLimit }, work);
  await Promise.all(runners);

  bar.stop();
  stopAllBars();

  const totalSizeStr = formatBytes(successSize + skipSize);
  const newSizeStr = formatBytes(successSize);

  logger.info(
    `Complete with total size ${totalSizeStr}${successSize > 0 && skipSize > 0 ? ` (newly generated: ${newSizeStr})` : ""}`,
  );

  if (raw.blurClean) {
    const srcFiles: string[] = [];
    const files = await scanGlob("**/*", { cwd: blurOut, absolute: true, dot: false });
    srcFiles.push(...files);

    for (const p of srcFiles) {
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

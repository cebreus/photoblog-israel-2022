import { createLogger } from "$scripts/core/cli-logger";
import type { CliOptions } from "$scripts/core/cli-parser";
import { getConcurrency } from "$scripts/core/concurrency-utils";
import { createBar, stopAllBars } from "$scripts/core/progress-manager";
import { logResourceUsage } from "$scripts/utils/performance";
import {
  basenameNoExt,
  fileExists,
  safeUnlink,
  scanGlob,
  stat,
  unlink,
} from "$scripts/utils/runtime";
import { isPng } from "$shared/types/images";
import { confirm, isCancel } from "@clack/prompts";
import path from "node:path";
import { config } from "../../build.config";
import { ensureDir, prepareImageProcessingPath } from "./utils";

const logger = createLogger("blur");

type SharpModule = typeof import("sharp");
let sharpSingleton: SharpModule | null = null;
async function loadSharp(): Promise<SharpModule> {
  if (sharpSingleton) return sharpSingleton;
  const mod = (await import("sharp")) as unknown as { default: SharpModule } | SharpModule;
  sharpSingleton = "default" in mod ? mod.default : mod;
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

  const baseName = basenameNoExt(file);
  const outPath = path.join(blurOut, `${baseName}.png`);

  let tempPath: string | null = null;
  try {
    // Basic cache check: skip if output exists and is newer than source
    if (!raw.clean && !raw.blurClean) {
      try {
        const [inStat, outStat] = await Promise.all([stat(file), stat(outPath)]);
        if (outStat.mtimeMs > inStat.mtimeMs) {
          return { status: "skipped", size: outStat.size };
        }
      } catch {
        // file not found, proceed
      }
    }

    let processingPath = file;

    const { processingPath: resolvedPath, tempFile } = await prepareImageProcessingPath(file);
    processingPath = resolvedPath;
    tempPath = tempFile;

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

    const finalStat = await stat(outPath);
    return { status: "success", size: finalStat.size };
  } catch (err: unknown) {
    logger.error({ err, file }, "Blur processing failed");
    return { status: "fail", size: 0 };
  } finally {
    await safeUnlink(tempPath);
  }
}

export async function runBlurBuild(raw: Partial<CliOptions>, concurrency: number): Promise<void> {
  let blurSrc = raw.blurSrc || config.blur.src;
  const blurOut = raw.blurOut || config.blur.out;

  // Validation & Fallback
  try {
    await fileExists(blurSrc);
  } catch (_e) {
    // Only offer fallback if it's the default optimized path
    if (!raw.blurSrc || raw.blurSrc === config.blur.src) {
      const fallbackSrc = config.paths.source;

      if (process.stdout.isTTY) {
        logger.warn({ blurSrc }, "Source directory not found");
        const useFallback = await confirm({
          message: `Use original images from "${fallbackSrc}" instead?`,
          initialValue: true,
        });

        if (isCancel(useFallback) || !useFallback) {
          logger.info(
            {},
            "Operation cancelled by user. Tip: Run 'pnpm process images' first to generate optimized previews.",
          );
          return;
        }
      } else {
        // Non-interactive (CI/Automatic) - keep automatic fallback for robustness
        logger.warn(
          { blurSrc, fallbackSrc },
          "Optimized previews not found. Falling back to original images for blur generation.",
        );
      }

      blurSrc = fallbackSrc;

      try {
        await fileExists(blurSrc);
      } catch (_e2) {
        throw new Error(
          `Blur generation failed: Source directory not found. Tried optimized previews (${config.blur.src}) and originals (${config.paths.source}). Please ensure that either 'static-<gallery>/images/previews-xl' exists or 'content/<gallery>/pics' contains source images.`,
        );
      }
    } else {
      throw new Error(
        `Blur generation failed: Provided source directory "${blurSrc}" does not exist.`,
      );
    }
  }

  logger.debug({ blurSrc, blurOut, format: "png" }, "Blur build config");

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
  } catch (err: unknown) {
    throw new Error(
      `Failed to scan source directory "${blurSrc}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (srcFiles.length === 0) {
    logger.warn({ blurSrc }, "No images found for blur generation");
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
      if (completedCount % 50 === 0) {
        logResourceUsage(`blur-progress-${completedCount}`);
      }

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
    {
      totalSize: totalSizeStr,
      newlyGenerated: successSize > 0 && skipSize > 0 ? newSizeStr : undefined,
    },
    "Blur generation complete",
  );

  if (!raw.blurClean) return;

  const filesToRemove = await scanGlob("**/*", { cwd: blurOut, absolute: true, dot: false });
  for (const p of filesToRemove) {
    if (isPng(path.extname(p))) continue;

    try {
      await unlink(p);
    } catch {
      // Ignore unlink errors
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

import {
  isHeicPath,
  isJpegPath,
  mkdir,
  safeUnlink,
  validatePathInsideRoot,
} from "$scripts/utils/runtime";
import { run } from "$scripts/utils/shell";
import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { config } from "../../build.config";
import { prepareImageProcessingPath } from "./utils";

const TMP_DIR = process.env.TMPDIR ?? "/tmp";
const SAFE_PROJECT_ROOT = process.cwd();

/**
 * Returns the output directory for fixed underwater images based on the active gallery.
 */
function getSafeOutputRoot() {
  return path.resolve(SAFE_PROJECT_ROOT, config.paths.siteSource, "fixed-underwater-images");
}

async function ensureSafeOutputDir(outputRoot: string) {
  await mkdir(outputRoot, { recursive: true });
}

export async function fixUnderwaterImage(input: string | Buffer, outputs?: string | string[]) {
  let outputList: string[] = [];
  if (outputs) {
    outputList = Array.isArray(outputs) ? outputs : [outputs];
  }
  const temps: string[] = [];
  const safeOutputRoot = getSafeOutputRoot();

  try {
    let finalInput: string | Buffer = "";
    let originalInputPathForExif: string | null = null;

    if (typeof input === "string") {
      // Validate that the input path is within the project directory
      const safeInputPath = validatePathInsideRoot(input, SAFE_PROJECT_ROOT);
      originalInputPathForExif = safeInputPath;

      const { processingPath, tempFile } = await prepareImageProcessingPath(safeInputPath);
      finalInput = processingPath;
      if (tempFile) temps.push(tempFile);
    } else {
      finalInput = input;
    }

    const image = sharp(finalInput);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    if (!width || !height) throw new Error("Could not get dimensions");

    const redOverlay = await sharp({
      create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const pipeline = image
      .composite([
        { input: redOverlay, blend: "multiply" },
        { input: finalInput, blend: "screen" },
      ])
      .recomb([
        [1.0, 0.0, 0.0],
        [0.0, 0.9, 0.0],
        [0.0, 0.0, 0.75],
      ])
      .normalise()
      .linear(1.0, 5.0)
      .gamma(1.1)
      .modulate({ saturation: 1.3, brightness: 1.05 })
      .clahe({ width: 100, height: 100 })
      .sharpen({ sigma: 1.0, m1: 0, m2: 3.0, x1: 2.0, y2: 10.0, y3: 20.0 });

    if (outputList.length === 0) {
      return await pipeline.toBuffer();
    }

    await ensureSafeOutputDir(safeOutputRoot);
    const jobs = outputList.map(async (output) => {
      const safeOutputPath = validatePathInsideRoot(output, safeOutputRoot);

      if (isHeicPath(safeOutputPath)) {
        const tiffOut = path.join(TMP_DIR, `uw_out_${crypto.randomUUID()}.tiff`);
        temps.push(tiffOut);
        await pipeline.clone().tiff({ compression: "none" }).toFile(tiffOut);
        await run(
          "sips",
          ["-s", "format", "heic", "-s", "formatOptions", "90", tiffOut, "--out", safeOutputPath],
          { stdio: "ignore" },
        );
      } else if (isJpegPath(safeOutputPath)) {
        await pipeline
          .clone()
          .jpeg({ quality: 90, mozjpeg: true, progressive: true })
          .toFile(safeOutputPath);
      } else {
        await pipeline.clone().toFile(safeOutputPath);
      }

      if (originalInputPathForExif) {
        await run(
          "exiftool",
          [
            "-overwrite_original",
            "-tagsFromFile",
            originalInputPathForExif,
            "-all:all",
            safeOutputPath,
          ],
          { stdio: "ignore" },
        );
      }
    });

    await Promise.all(jobs);
  } catch (err: unknown) {
    throw new Error(`Underwater fix failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await Promise.all(temps.map((t) => safeUnlink(t)));
  }
}

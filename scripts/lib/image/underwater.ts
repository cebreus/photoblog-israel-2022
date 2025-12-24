import crypto from "node:crypto"; // Bun's native crypto
import { mkdir, unlink } from "node:fs/promises"; // Bun's native fs/promises
import path from "node:path"; // Bun's native path module
import sharp from "sharp";
import { config } from "../../build.config";
import { validatePathInsideRoot } from "../utils/path";
import { run } from "../utils/shell";

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
  const outputList = outputs ? (Array.isArray(outputs) ? outputs : [outputs]) : [];
  const temps: string[] = [];
  const safeOutputRoot = getSafeOutputRoot();

  try {
    let finalInput: string | Buffer = "";
    let originalInputPathForExif: string | null = null;

    if (typeof input === "string") {
      // Validate that the input path is within the project directory
      const safeInputPath = validatePathInsideRoot(input, SAFE_PROJECT_ROOT);
      originalInputPathForExif = safeInputPath;

      const ext = path.extname(safeInputPath).toLowerCase();
      if (ext === ".heic" || ext === ".heif") {
        const tiffIn = path.join(TMP_DIR, `uw_in_${crypto.randomUUID()}.tiff`);
        temps.push(tiffIn);
        await run("vips", ["copy", safeInputPath, tiffIn], { stdio: "ignore" });
        finalInput = tiffIn;
      } else {
        finalInput = safeInputPath;
      }
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

    if (outputList.length > 0) {
      await ensureSafeOutputDir(safeOutputRoot);
      const jobs = outputList.map(async (output) => {
        const safeOutputPath = validatePathInsideRoot(output, safeOutputRoot);
        const outExt = path.extname(safeOutputPath).toLowerCase();

        if (outExt === ".heic" || outExt === ".heif") {
          const tiffOut = path.join(TMP_DIR, `uw_out_${crypto.randomUUID()}.tiff`);
          temps.push(tiffOut);
          await pipeline.clone().tiff({ compression: "none" }).toFile(tiffOut);
          await run(
            "sips",
            ["-s", "format", "heic", "-s", "formatOptions", "90", tiffOut, "--out", safeOutputPath],
            { stdio: "ignore" },
          );
        } else if (outExt === ".jpg" || outExt === ".jpeg") {
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
    } else {
      return await pipeline.toBuffer();
    }
  } catch (err: any) {
    throw new Error(`Underwater fix failed: ${err.message}`);
  } finally {
    for (const t of temps) {
      await unlink(t).catch(() => {});
    }
  }
}

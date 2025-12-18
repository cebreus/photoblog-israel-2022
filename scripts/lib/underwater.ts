import { unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { run } from "./shell-utils";

const TMP_DIR = process.env.TMPDIR ?? "/tmp";

export async function fixUnderwaterImage(input: string | Buffer, outputs?: string | string[]) {
  const outputList = outputs ? (Array.isArray(outputs) ? outputs : [outputs]) : [];
  const temps: string[] = [];

  try {
    let finalInput: string | Buffer = "";
    if (typeof input === "string") {
      const ext = path.extname(input).toLowerCase();
      if (ext === ".heic" || ext === ".heif") {
        const tiffIn = path.join(TMP_DIR, `uw_in_${crypto.randomUUID()}.tiff`);
        temps.push(tiffIn);
        await run("vips", ["copy", input, tiffIn], { stdio: "ignore" });
        finalInput = tiffIn;
      } else {
        finalInput = input;
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
      const jobs = outputList.map(async (output) => {
        const outExt = path.extname(output).toLowerCase();
        if (outExt === ".heic" || outExt === ".heif") {
          const tiffOut = path.join(TMP_DIR, `uw_out_${crypto.randomUUID()}.tiff`);
          temps.push(tiffOut);
          await pipeline.clone().tiff({ compression: "none" }).toFile(tiffOut);
          await run(
            "sips",
            ["-s", "format", "heic", "-s", "formatOptions", "90", tiffOut, "--out", output],
            { stdio: "ignore" },
          );
        } else if (outExt === ".jpg" || outExt === ".jpeg") {
          await pipeline
            .clone()
            .jpeg({ quality: 90, mozjpeg: true, progressive: true })
            .toFile(output);
        } else {
          await pipeline.clone().toFile(output);
        }

        if (typeof input === "string") {
          await run(
            "exiftool",
            ["-overwrite_original", "-tagsFromFile", input, "-all:all", output],
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

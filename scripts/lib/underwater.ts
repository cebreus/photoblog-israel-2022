import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

/**
 * Converts HEIC/HEIF to JPEG using vips CLI, similar to scripts/lib/image-processor.ts
 */
async function convertHeicIfNeeded(
  inputPath: string,
): Promise<{ processingPath: string; isTemp: boolean }> {
  const ext = path.extname(inputPath).slice(1).toLowerCase();
  if (ext === "heic" || ext === "heif") {
    const tmpPath = path.join(os.tmpdir(), `underwater_temp_${crypto.randomUUID()}.jpg`);
    try {
      // Use vips copy to convert
      await execFileAsync("vips", ["copy", inputPath, tmpPath]);
      return { processingPath: tmpPath, isTemp: true };
    } catch (error) {
      throw new Error(`Failed to convert HEIC using vips: ${(error as Error).message}`);
    }
  }
  return { processingPath: inputPath, isTemp: false };
}

/**
 * Fixes underwater images by restoring red channel and adjusting contrast.
 * Based on reverse-engineered Photoshop action:
 * 1. Red Channel Recovery: Overlay RGB(255, 90, 40) with multiply blend mode.
 * 2. Compesation: Enhance brightness, saturation and gamma to counter the darkening effect of multiply.
 *
 * @param input - Path to input image or Buffer
 * @param output - Path to output image (optional, if not provided returns Buffer)
 * @returns Promise<Buffer | void>
 */
export async function fixUnderwaterImage(
  input: string | Buffer,
  output?: string,
): Promise<Buffer | void> {
  let tempCleanupPath: string | null = null;

  try {
    let processingPath = "";
    let inputBuffer: Buffer | null = null;

    // 1. Prepare Input
    if (Buffer.isBuffer(input)) {
      inputBuffer = input;
    } else {
      // Handle file path, potentially converting HEIC
      const conversionResult = await convertHeicIfNeeded(input);
      processingPath = conversionResult.processingPath;
      if (conversionResult.isTemp) {
        tempCleanupPath = conversionResult.processingPath;
      }
    }

    // 2. Load the input image
    const image = inputBuffer ? sharp(inputBuffer) : sharp(processingPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not get image dimensions");
    }

    // 3. Create the red/orange overlay layer
    // Color: RGB(255, 0, 0) based on ATN analysis (pure red extraction)
    const overlay = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png() // Convert to buffer for compositing
      .toBuffer();

    // 4. Apply corrections
    // Analysis of underwater.atn suggests:
    // 1. Solid Color (Red) with Multiply (restores color but darkens)
    // 2. Screen blending with original (restores brightness)
    // 3. Auto Levels (normalise)

    // Step A: Multiply with Red Overlay
    // We already prepared 'overlay' (Red 255,90,40)
    // We need to composite it. Note: 'image' is the Sharp instance of input.
    // We need to be careful: sharp operations are pipelined.

    // We need the input buffer to use it multiple times (for Screen step)
    // inputBuffer might be set, or we read from processingPath
    const baseBuffer = await image.toBuffer();

    // A: Multiplied = Base * RedOverlay
    const multiplied = await sharp(baseBuffer)
      .composite([{ input: overlay, blend: "multiply" }])
      .toBuffer();

    // B: Screen = Multiplied SCREEN Base
    // This brings back brightness using the original image's luminance
    const screened = await sharp(multiplied)
      .composite([{ input: baseBuffer, blend: "screen" }])
      .toBuffer();

    // C: Auto Levels (normalize) + Advanced Corrections
    // 1. Normalise (Auto Levels) - Stretches global contrast
    // 2. Modulate (Saturation) - Boosted to 1.3 for "aquarium look"
    // 3. CLAHE (Dehaze) - Local contrast enhancement to cut through water haze
    // 4. Sharpen - Restore details lost by water/glass
    const pipeline = sharp(screened)
      .recomb([
        [1.0, 0.0, 0.0], // Red: 100%
        [0.0, 0.9, 0.0], // Green: 90% (Reduce Cyan/Green tint common in Red Sea)
        [0.0, 0.0, 0.75], // Blue: 75% (Attenuate dominant blue)
      ])
      .normalise()
      .linear(1.0, 5.0) // Lift black point by ~2% (5/255) to prevent crushing ("faded blacks")
      .gamma(1.1) // Lift shadows slightly (prevent crushed blacks)
      .modulate({
        saturation: 1.3, // Boosted from 1.1 to 1.3 for vibrant tropical colors
        brightness: 1.05, // Slight brightness boost (was 1.0)
      })
      .clahe({
        width: 100, // Increased window size (50->100) to reduce local grit/banding in smooth areas (sand)
        height: 100,
      })
      .sharpen({
        sigma: 1.0, // Reduced from 1.5 (too aggressive) to 1.0
        m1: 0, // Flat areas (sand/noise): Do NOT sharpen (was 1.0)
        m2: 3.0, // Edges (fish/coral): Sharpen strongly (was 2.0) to compensate for lower sigma
        x1: 2.0, // Threshold for "flat": Noise/Sand usually falls below this
        y2: 10.0, // Threshold for "jagged": Strong edges
        y3: 20.0,
      });

    // 6. Output
    if (output) {
      await pipeline.withMetadata().toFile(output);
    } else {
      return await pipeline.withMetadata().toBuffer();
    }
  } catch (error) {
    throw new Error(`Failed to fix underwater image: ${(error as Error).message}`);
  } finally {
    if (tempCleanupPath) {
      await fs.unlink(tempCleanupPath).catch(() => {});
    }
  }
}

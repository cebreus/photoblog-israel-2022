/**
 * @fileoverview Image Metrics Unit Tests
 *
 * @description
 * Tests the extraction of technical image metrics.
 * Verifies correctness of Sharpness calculation (Laplacian variance) and
 * perceptual hash (pHash) stability under resizing.
 *
 * @modules-tested
 * - scripts/lib/image-utils.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { calculatePhash, calculateSharpness } from "../../scripts/lib/image-utils";

describe("Metric Extraction (Unit)", () => {
  const sharpImgPath = path.resolve(process.cwd(), "tests/fixtures/sharp_test.jpg");
  const blurImgPath = path.resolve(process.cwd(), "tests/fixtures/blur_test.jpg");
  const resizedImgPath = path.resolve(process.cwd(), "tests/fixtures/resized_test.jpg");

  beforeAll(async () => {
    // Ensure fixtures dir exists
    const dir = path.dirname(sharpImgPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(`${dir}/.keep`, "");

    // Create a CHECKERBOARD pattern instead of random noise
    // Random noise behaves poorly with resizing (aliasing)
    const width = 100;
    const height = 100;
    const buffer = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isWhite = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0;
        const idx = (y * width + x) * 3;
        const val = isWhite ? 255 : 0;
        buffer[idx] = val;
        buffer[idx + 1] = val;
        buffer[idx + 2] = val;
      }
    }

    await sharp(buffer, { raw: { width, height, channels: 3 } })
      .toFormat("jpeg")
      .toFile(sharpImgPath);

    // Create a blurred version
    await sharp(sharpImgPath)
      .blur(5) // Moderate blur
      .toFile(blurImgPath);

    // Create a resized version
    await sharp(sharpImgPath).resize(50, 50).toFile(resizedImgPath);
  });

  it("calculates higher sharpness for sharp image than blurred image", async () => {
    const scoreSharp = await calculateSharpness(sharp, sharpImgPath);
    const scoreBlur = await calculateSharpness(sharp, blurImgPath);

    // console.log(`Sharpness Score - Sharp: ${scoreSharp}, Blur: ${scoreBlur}`);
    expect(scoreSharp).toBeGreaterThan(scoreBlur);
  });

  it("calculates identical or very similar pHash for original and resized image", async () => {
    const hashOriginal = await calculatePhash(sharp, sharpImgPath);
    const hashResized = await calculatePhash(sharp, resizedImgPath);

    // console.log(`pHash - Original: ${hashOriginal}, Resized: ${hashResized}`);

    let diff = 0;
    const h1 = BigInt(`0x${hashOriginal}`);
    const h2 = BigInt(`0x${hashResized}`);
    const xor = h1 ^ h2;
    const diffStr = xor.toString(2);
    for (const char of diffStr) {
      if (char === "1") diff++;
    }

    // console.log(`Hamming distance: ${diff}`);
    expect(diff).toBeLessThanOrEqual(5);
  });
});

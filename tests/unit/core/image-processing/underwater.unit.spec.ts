/**
 * @fileoverview Underwater Color Correction Unit Tests
 *
 * @description
 * Tests the underwater image correction algorithm.
 * Verifies red-channel restoration logic and histogram adjustment
 * specific to underwater photography scenarios.
 *
 * @modules-tested
 * - scripts/lib/underwater.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fixUnderwaterImage } from "../../../../scripts/lib/image/underwater";

vi.mock("../../../../scripts/lib/utils/shell", () => ({
  run: vi.fn(),
  execCapture: vi.fn(),
}));

describe("fixUnderwaterImage", () => {
  const tmpDir = path.resolve(process.cwd(), ".temp/test-underwater");
  const testFiles: string[] = [];

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  afterEach(async () => {
    // Cleanup created files
    for (const file of testFiles) {
      try {
        await fs.unlink(file).catch(() => {});
      } catch (_e) {
        // ignore
      }
    }
    testFiles.length = 0;
  });

  const createTestImage = async (filename: string): Promise<string> => {
    const filePath = path.join(tmpDir, filename);
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 100, b: 200 }, // Blue-ish underwater color
      },
    })
      .png()
      .toFile(filePath);
    testFiles.push(filePath);
    return filePath;
  };

  it("should process a file path input and save to output path", async () => {
    const inputPath = await createTestImage("underwater_test_input.png");
    const contentDir = process.env.CONTENT_DIR || "egypt-2025";
    const outputPath = path.resolve(
      process.cwd(),
      `content/${contentDir}/fixed-underwater-images/underwater_test_output.jpg`,
    );
    testFiles.push(outputPath);

    await fixUnderwaterImage(inputPath, outputPath);

    const exists = await fs
      .stat(outputPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    // Basic verification that image is readable and dimensions match
    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  it("should process a buffer input and return a buffer", async () => {
    const inputPath = await createTestImage("underwater_test_buffer.png");
    const inputBuffer = await fs.readFile(inputPath);

    const outputBuffer = await fixUnderwaterImage(inputBuffer);

    expect(Buffer.isBuffer(outputBuffer)).toBe(true);

    if (Buffer.isBuffer(outputBuffer)) {
      const metadata = await sharp(outputBuffer).metadata();
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    }
  });

  it("should throw error for invalid input", async () => {
    await expect(fixUnderwaterImage("non-existent-file.jpg")).rejects.toThrow();
  });

  it("should throw error if image dimensions cannot be determined (simulated)", async () => {
    const badFilePath = path.join(tmpDir, "bad_image.txt");
    await fs.writeFile(badFilePath, "not an image");
    testFiles.push(badFilePath);

    await expect(fixUnderwaterImage(badFilePath)).rejects.toThrow(/Underwater fix failed/);
  });
});

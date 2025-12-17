import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { fixUnderwaterImage } from "../../scripts/lib/underwater";

describe("fixUnderwaterImage", () => {
  const tmpDir = os.tmpdir();
  const testFiles: string[] = [];

  afterEach(async () => {
    // Cleanup created files
    for (const file of testFiles) {
      try {
        await fs.unlink(file).catch(() => {});
      } catch (e) {
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
    const outputPath = path.join(tmpDir, "underwater_test_output.jpg");
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
    // Hard to simulate with real sharp, but ensuring robust error handling involves
    // checking that it catches errors from sharp.
    // Passing a text file as input should cause sharp to fail.
    const badFilePath = path.join(tmpDir, "bad_image.txt");
    await fs.writeFile(badFilePath, "not an image");
    testFiles.push(badFilePath);

    await expect(fixUnderwaterImage(badFilePath)).rejects.toThrow(/Failed to fix underwater image/);
  });
});

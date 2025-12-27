import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateLayout } from "../../../src/lib/utils/collage-layout-engine";
import { renderCollage } from "../../../src/lib/utils/collage-renderer";
import { buildInputSet } from "../../utils/fixtures";

describe("Collage Ambient Background Integration", () => {
  const TEMP_DIR = path.join(process.cwd(), "tests/.temp/ambient-test");
  let testImages: Awaited<ReturnType<typeof buildInputSet>>;

  beforeAll(async () => {
    // Prepare a fresh set of curated test images
    testImages = await buildInputSet(TEMP_DIR);
  });

  afterAll(async () => {
    // Cleanup temp files
    try {
      await fs.rm(TEMP_DIR, { recursive: true, force: true });
    } catch (_e) {
      // ignore
    }
  });

  it("should generate ambient background from high-alpha (transparent) source without black artifacts", async () => {
    // 1. Prepare items for layout
    // Using alpha.png (green with 0.25 alpha) to stress-test alpha removal/flattening
    const items = [
      {
        id: "item1",
        width: 40,
        height: 30,
        path: testImages.pngAlpha,
      },
    ];

    // 2. Calculate a basic row layout with a large border to see the "ambient" effect
    const border = {
      width: 100, // Large border
      color: "#ffffff",
      backgroundStyle: "ambient" as const,
      userSetting: 10,
    };

    const layout = calculateLayout(items, "row", { border });
    console.log(
      `Test Layout: ${layout.width}x${layout.height}, Item Path: ${layout.placements[0]?.item?.path}`,
    );

    // 3. Render
    const resultBuffer = await renderCollage(layout, border);

    // 4. Detailed Assertions
    expect(resultBuffer).toBeDefined();

    const { data, info } = await sharp(resultBuffer).raw().toBuffer({ resolveWithObject: true });

    // Check pixel in the "ambient" area (top-left margin)
    const idxCorner = (10 * info.width + 10) * info.channels;
    const gCorner = data[idxCorner + 1];

    // Check center pixel (directly on top of the content)
    const idxCenter =
      (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
    const gCenter = data[idxCenter + 1];

    console.log(`Ambient green at (10,10): ${gCorner}`);
    console.log(
      `Ambient green at center (${Math.floor(info.width / 2)},${Math.floor(info.height / 2)}): ${gCenter}`,
    );

    // Debug stats on failure
    const stats = await sharp(resultBuffer).stats();
    if (gCenter < 100) {
      console.log("Full Stats on failure:", JSON.stringify(stats, null, 2));
    }

    // If it was failing and interpreting transparency as black, G would be near 0.
    // With modulate(0.6 brightness) on pure Green (255), we expect ~153.
    expect(gCenter).toBeGreaterThan(100);

    // Corner should also have some green color due to large blur
    expect(gCorner).toBeGreaterThan(20);
  });

  it("should correctly combine multiple different sources in ambient background", async () => {
    // Mix portrait (blueish) and webp (yellowish)
    const items = [
      { id: "p1", width: 600, height: 900, path: testImages.portraitJpeg },
      { id: "p2", width: 300, height: 300, path: testImages.webpImg },
    ];

    const border = {
      width: 50,
      color: "#ffffff",
      backgroundStyle: "ambient" as const,
    };

    const layout = calculateLayout(items, "row", { border });
    const resultBuffer = await renderCollage(layout, border);

    const stats = await sharp(resultBuffer).stats();

    // Image should have diverse colors (not monochromatic)
    const redMean = stats.channels[0].mean;
    const greenMean = stats.channels[1].mean;
    const blueMean = stats.channels[2].mean;

    console.log(
      `Means - R: ${redMean.toFixed(1)}, G: ${greenMean.toFixed(1)}, B: ${blueMean.toFixed(1)}`,
    );

    expect(blueMean).toBeGreaterThan(10); // From portrait image
    expect(redMean + greenMean).toBeGreaterThan(20); // From webp image
  });
});

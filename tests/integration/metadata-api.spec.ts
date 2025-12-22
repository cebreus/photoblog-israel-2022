/**
 * @fileoverview Metadata API Integration Tests
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { exiftool } from "exiftool-vendored";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as updateMetadata } from "../../src/routes/api/metadata/+server";

describe("Integration: Metadata API", () => {
  let contentDir: string;
  let dataDir: string;
  let picsDir: string;
  let manifestPath: string;
  const originalContentDir = process.env.CONTENT_DIR;

  beforeEach(async () => {
    contentDir = `test-meta-${Date.now()}`;
    const projectRoot = process.cwd();
    const testContentRoot = path.join(projectRoot, "content", contentDir);
    const testDataRoot = path.join(projectRoot, "src/data", contentDir);

    await fsp.mkdir(path.join(testContentRoot, "pics"), { recursive: true });
    await fsp.mkdir(testDataRoot, { recursive: true });

    picsDir = path.join(testContentRoot, "pics");
    dataDir = testDataRoot;
    manifestPath = path.join(dataDir, "images.manifest.json");

    // Create dummy manifest
    const manifest = {
      photoDays: [
        {
          date: "2024-01-01",
          id: "day1",
          items: [
            {
              id: "img1",
              type: "image",
              src: "img1.jpg", // Relative to gallery root in manifest context often
              alt: "Img 1",
              sources: [],
            },
          ],
        },
      ],
    };
    await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Create dummy file - but we want ExifTool to be able to write to it
    // A simple text file might work if it's named .jpg, but better use a small valid JPG if possible
    // For now we'll just test the manifest update and errors.
    await fsp.writeFile(path.join(picsDir, "img1.jpg"), "dummy data");

    process.env.CONTENT_DIR = contentDir;
  });

  afterEach(async () => {
    const projectRoot = process.cwd();
    await fsp.rm(path.join(projectRoot, "content", contentDir), { recursive: true, force: true });
    await fsp.rm(path.join(projectRoot, "src/data", contentDir), { recursive: true, force: true });
    process.env.CONTENT_DIR = originalContentDir;
    await exiftool.end();
  });

  it("POST /api/metadata should return error if no imageIds", async () => {
    const request = {
      json: async () => ({ imageIds: [], metadata: {} }),
    };

    try {
      await updateMetadata({ request } as any);
    } catch (e: any) {
      expect(e.status).toBe(400);
      expect(e.body.message).toContain("No image IDs provided.");
    }
  });

  it("POST /api/metadata should handle missing image", async () => {
    const request = {
      json: async () => ({
        imageIds: ["missing"],
        metadata: { title: "New Title" },
      }),
    };

    const res = await updateMetadata({ request } as any);
    const body = await res.json();

    expect(body.stats.failed).toBe(1);
    expect(body.results.failed[0].error).toContain("was not found in the manifest");
  });

  it("POST /api/metadata should detect no changes", async () => {
    const request = {
      json: async () => ({
        imageIds: ["img1"],
        metadata: {}, // empty updates
      }),
    };

    const res = await updateMetadata({ request } as any);
    const body = await res.json();
    expect(body.message).toContain("No metadata changes detected");
  });
});

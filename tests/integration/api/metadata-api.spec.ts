/**
 * @fileoverview Metadata/Images API Integration Tests
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH as updateImages } from "../../../src/routes/api/images/+server";

describe("Integration: Images API (Metadata)", () => {
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
              src: "img1.jpg",
              alt: "Img 1",
              sources: [],
            },
          ],
        },
      ],
    };
    await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Create a dummy file (text content is enough to crash exiftool if called,
    // or we can test that it handles missing files correctly)
    await fsp.writeFile(path.join(picsDir, "img1.jpg"), "dummy data");

    process.env.CONTENT_DIR = contentDir;
  });

  afterEach(async () => {
    const projectRoot = process.cwd();
    // Clean up test directories
    await fsp
      .rm(path.join(projectRoot, "content", contentDir), { recursive: true, force: true })
      .catch(() => {});
    await fsp
      .rm(path.join(projectRoot, "src/data", contentDir), { recursive: true, force: true })
      .catch(() => {});

    process.env.CONTENT_DIR = originalContentDir;
    // Note: We do *not* call exiftool.end() here as it might be shared or managed globally.
    // If this test suite starts exiftool, it should close it, but usually the app manages it.
    // Safe to leave it running for other tests.
  });

  it("PATCH /api/images should return error if no images or updates", async () => {
    const request = {
      json: async () => ({ images: [], updates: {} }),
    };
    const locals = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      logContext: {},
    };

    const res = await updateImages({ request, locals } as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toContain("Invalid request");
  });

  it("PATCH /api/images should handle no metadata updates", async () => {
    const request = {
      json: async () => ({
        images: [{ id: "img1", src: "img1.jpg" }],
        updates: {}, // empty updates
      }),
    };
    const locals = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      logContext: {},
    };

    const res = await updateImages({ request, locals } as any);
    const body = await res.json();

    expect(res.status).toBe(500); // 500 because it returns "Failed to update metadata" error list
    expect(body.message).toContain("No metadata to update");
  });

  it("PATCH /api/images should report error for invalid image file", async () => {
    const request = {
      json: async () => ({
        images: [{ id: "img1", src: `/images/${contentDir}/img1.jpg` }],
        updates: { title: "New Title" },
      }),
    };
    const locals = {
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      logContext: {},
    };

    const res = await updateImages({ request, locals } as any);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors[0]).toMatch(/ExifTool failed|Manifest not found/);
  });
});

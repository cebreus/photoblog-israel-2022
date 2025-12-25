/**
 * @fileoverview Gallery Migration Unit Tests
 *
 * @description
 * Tests the logic for migrating legacy gallery data or structures.
 * Verifies traversing directories, identifying assets, and transforming
 * data models to the current schema.
 *
 * @modules-tested
 * - scripts/lib/gallery-migration.ts (or similar)
 */

// fs import removed
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  migrateCache,
  migrateGeneratedAssets,
  migrateImagesManifest,
} from "../../../../scripts/lib/gallery/migration";
import * as renamingUtils from "../../../../scripts/lib/gallery/renaming";
import * as repo from "../../../../scripts/lib/manifests/repository";

// Mock dependencies
// node:fs mock removed
vi.mock("node:fs/promises", () => {
  const fsImpl = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    access: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
  };
  return { ...fsImpl, default: fsImpl };
});
vi.mock("../../../../scripts/lib/gallery/renaming", () => ({ safeRename: vi.fn() }));
vi.mock("../../../../scripts/lib/manifests/repository", () => ({
  loadManifest: vi.fn(),
  saveManifest: vi.fn(),
  loadImagesManifest: vi.fn(),
  saveImagesManifest: vi.fn(),
  loadPeopleManifest: vi.fn(),
  savePeopleManifest: vi.fn(),
  loadCurationManifest: vi.fn(),
  saveCurationManifest: vi.fn(),
}));
vi.mock("fast-glob", () => ({ default: vi.fn() }));

// Mock Config
vi.mock("../../../../scripts/build.config", () => ({
  config: {
    outputs: {
      preview: { kind: "variant", folderName: "previews" },
      placeholder: { kind: "other", folderName: "placeholders" },
    },
    encoding: { formats: ["webp"] },
  },
}));

const mockRenameMap = new Map([
  [
    "/abs/old.jpg",
    {
      oldName: "old.jpg",
      newName: "new.jpg",
      oldPath: "/abs/old.jpg",
      newPath: "/abs/new.jpg",
      oldBase: "old",
      newBase: "new",
      oldRelPath: "old.jpg",
      newRelPath: "new.jpg",
    },
  ],
]);

describe("gallery-migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("migrateGeneratedAssets", () => {
    it("should rename assets for all formats", async () => {
      // Mock Bun.file to return true for existence checks
      const bun = (globalThis as any).Bun;
      if (!bun || !bun.file) {
        throw new Error("Bun with Bun.file is required for this test");
      }
      const originalBunFile = bun.file;
      bun.file = vi.fn(() => ({
        exists: async () => true,
      })) as any;

      try {
        await migrateGeneratedAssets("test-gallery", mockRenameMap as any);

        // Expect checks for previews-webp, previews, placeholders
        // old.webp -> new.webp
        expect(renamingUtils.safeRename).toHaveBeenCalled();
      } finally {
        bun.file = originalBunFile;
      }
    });
  });

  describe("migrateCache", () => {
    it("should update cache paths", async () => {
      const mockCache = {
        files: {
          "old.jpg": { outputs: ["previews/old.webp", "previews/old.jpg"] },
        },
      };
      (repo.loadManifest as any).mockResolvedValue(mockCache);

      await migrateCache("test-gallery", mockRenameMap as any);

      expect(repo.saveManifest).toHaveBeenCalledWith(
        expect.stringContaining("images.cache.json"),
        expect.objectContaining({
          files: expect.objectContaining({
            "new.jpg": expect.objectContaining({
              outputs: [expect.stringContaining("new.webp"), expect.stringContaining("new.jpg")],
            }),
          }),
        }),
      );
    });
  });

  describe("migrateImagesManifest", () => {
    it("should update image entries", async () => {
      const mockManifest = {
        photoDays: [
          {
            items: [
              {
                type: "image",
                src: "old.jpg",
                id: "old",
                sources: [{ path: "previews/old.webp" }],
              },
            ],
          },
        ],
      };
      (repo.loadImagesManifest as any).mockResolvedValue(mockManifest);

      await migrateImagesManifest("test-gallery", mockRenameMap as any);

      expect(repo.saveImagesManifest).toHaveBeenCalled();
      const saved = (repo.saveImagesManifest as any).mock.calls[0][1];
      const item = saved.photoDays[0].items[0];
      expect(item.src).toBe("new.jpg");
      expect(item.id).toBe("new");
      expect(item.sources[0].path).toContain("new.webp");
    });
  });
});

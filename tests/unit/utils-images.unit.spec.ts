/**
 * @fileoverview General Image Utilities Unit Tests
 *
 * @description
 * Tests miscellaneous image utility functions.
 * Covers path handling, extension normalization, and basic file operations
 * related to image management.
 *
 * @modules-tested
 * - scripts/lib/utils-images.ts
 */

import { describe, expect, it, vi } from "vitest";
import type { ImageEntry } from "../../src/lib/types/manifest";
import {
  getCurationManifest,
  getImagePeopleMap,
  getManifest,
  getPeopleManifest,
  getPhotoDays,
  getSources,
} from "../../src/lib/utils/images";

// Mock the manifest imports
vi.mock("$manifests/images.manifest.json", () => ({
  default: {
    photoDays: [
      {
        id: "day1",
        date: "2025-01-01",
        items: [
          {
            id: "img1",
            type: "image",
            people: ["person1", "person2"],
          },
          {
            id: "img2",
            type: "image",
            people: [],
          },
          {
            id: "sep1",
            type: "separator",
          },
        ],
      },
    ],
  },
}));

vi.mock("$manifests/curation.manifest.json", () => ({
  default: {
    groups: [],
    stats: { totalPhotos: 2, totalGroups: 0, duplicatesFound: 0 },
  },
}));

vi.mock("$manifests/people.manifest.json", () => ({
  default: {
    people: [
      { id: "person1", name: "Alice" },
      { id: "person2", name: "Bob" },
    ],
  },
}));

vi.mock("$app/environment", () => ({
  dev: false,
}));

describe("images utils", () => {
  describe("getManifest", () => {
    it("returns the typed manifest", () => {
      const manifest = getManifest();
      expect(manifest).toHaveProperty("photoDays");
      expect(Array.isArray(manifest.photoDays)).toBe(true);
    });
  });

  describe("getPhotoDays", () => {
    it("returns photo days array", () => {
      const days = getPhotoDays();
      expect(Array.isArray(days)).toBe(true);
      expect(days.length).toBeGreaterThan(0);
      expect(days[0]).toHaveProperty("id");
    });
  });

  describe("getImagePeopleMap", () => {
    it("builds map of image IDs to people IDs", () => {
      const map = getImagePeopleMap();
      expect(map).toHaveProperty("img1");
      expect(map.img1).toEqual(["person1", "person2"]);
    });

    it("excludes images without people", () => {
      const map = getImagePeopleMap();
      expect(map).not.toHaveProperty("img2");
    });

    it("excludes separators", () => {
      const map = getImagePeopleMap();
      expect(map).not.toHaveProperty("sep1");
    });
  });

  describe("getCurationManifest", () => {
    it("returns curation manifest", () => {
      const curation = getCurationManifest();
      expect(curation).toHaveProperty("groups");
      expect(curation).toHaveProperty("stats");
    });
  });

  describe("getPeopleManifest", () => {
    it("returns people manifest", () => {
      const people = getPeopleManifest();
      expect(people).toHaveProperty("people");
      expect(Array.isArray(people.people)).toBe(true);
      expect(people.people.length).toBe(2);
    });
  });

  describe("getSources", () => {
    it("groups sources by type and sorts them correctly", () => {
      const mockItem: ImageEntry = {
        id: "test",
        sources: [
          {
            type: "image/jpeg",
            path: "img.jpg",
            variant: "default",
            width: 1000,
          },
          {
            type: "image/webp",
            path: "img.webp",
            variant: "default",
            width: 1000,
          },
          {
            type: "image/avif",
            path: "img.avif",
            variant: "default",
            width: 1000,
          },
          {
            type: "image/jpeg",
            path: "img_small.jpg",
            variant: "xl",
            width: 500,
          },
        ],
        // ... required props stub
        type: "image",
        src: "",
        alt: "",
        title: "",
        author: "",
        width: 1000,
        height: 1000,
        sizeMB: 1,
        placeholderColor: "",
        exif: {},
        analysis: { sharpness: 10, phash: "abc", embedding: [] },
      } as unknown as ImageEntry;

      const result = getSources(mockItem);

      // Expect order: AVIF, WebP, JPEG
      expect(result[0].type).toBe("image/avif");
      expect(result[1].type).toBe("image/webp");
      expect(result[2].type).toBe("image/jpeg");

      // Check srcset construction
      const jpegSource = result.find((s) => s.type === "image/jpeg");
      expect(jpegSource?.srcset).toContain("img.jpg 1000w");
      expect(jpegSource?.srcset).toContain("img_small.jpg 500w");
    });

    it("handles single format correctly", () => {
      const mockItem: ImageEntry = {
        id: "test",
        sources: [
          {
            type: "image/jpeg",
            path: "img.jpg",
            variant: "default",
            width: 1000,
          },
        ],
        type: "image",
        src: "",
        alt: "",
        title: "",
        author: "",
        width: 1000,
        height: 1000,
        sizeMB: 1,
        placeholderColor: "",
        exif: {},
        analysis: { sharpness: 10, phash: "abc", embedding: [] },
      } as unknown as ImageEntry;

      const result = getSources(mockItem);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("image/jpeg");
    });
  });
});

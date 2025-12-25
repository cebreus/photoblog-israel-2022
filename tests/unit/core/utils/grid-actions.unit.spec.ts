/**
 * @fileoverview Unit tests for grid-actions utilities
 */

import { describe, expect, it } from "vitest";
import {
  buildMetadataUpdatePayload,
  filterExcludedImages,
  getSelectedImages,
  mapImagesToApiFormat,
  removeFromSelection,
} from "$lib/utils/grid-actions";

describe("grid-actions", () => {
  describe("buildMetadataUpdatePayload", () => {
    it("includes only selected fields with values", () => {
      const fields = { title: true, author: true, location: false };
      const clipboard = { title: "Test Title", author: "John", location: "Paris" };

      const result = buildMetadataUpdatePayload(fields, clipboard);

      expect(result.title).toBe("Test Title");
      expect(result.author).toBe("John");
      expect(result.location).toBeUndefined();
    });

    it("excludes fields not in clipboard", () => {
      const fields = { title: true, author: true };
      const clipboard = { title: "Test Title" };

      const result = buildMetadataUpdatePayload(fields, clipboard);

      expect(result.title).toBe("Test Title");
      expect(result.author).toBeUndefined();
    });

    it("handles keywords array", () => {
      const fields = { keywords: true };
      const clipboard = { keywords: ["tag1", "tag2"] };

      const result = buildMetadataUpdatePayload(fields, clipboard);

      expect(result.keywords).toEqual(["tag1", "tag2"]);
    });

    it("excludes empty keywords array", () => {
      const fields = { keywords: true };
      const clipboard = { keywords: [] };

      const result = buildMetadataUpdatePayload(fields, clipboard);

      expect(result.keywords).toBeUndefined();
    });
  });

  describe("mapImagesToApiFormat", () => {
    it("maps images to id/src pairs", () => {
      const images = [
        { id: "img1", src: "/path/1.jpg" },
        { id: "img2", src: "/path/2.jpg" },
      ] as any[];

      const result = mapImagesToApiFormat(images);

      expect(result).toEqual([
        { id: "img1", src: "/path/1.jpg" },
        { id: "img2", src: "/path/2.jpg" },
      ]);
    });
  });

  describe("filterExcludedImages", () => {
    const images = [
      { id: "img1", src: "/1.jpg" },
      { id: "img2", src: "/2.jpg" },
      { id: "img3", src: "/3.jpg" },
    ] as any[];

    it("removes excluded images", () => {
      const result = filterExcludedImages(images, ["img2"]);

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.id)).toEqual(["img1", "img3"]);
    });

    it("returns all images when no exclusions", () => {
      const result = filterExcludedImages(images, []);

      expect(result).toHaveLength(3);
    });
  });

  describe("removeFromSelection", () => {
    it("removes IDs from selection", () => {
      const selection = new Set(["a", "b", "c", "d"]);
      const toRemove = ["b", "d"];

      const result = removeFromSelection(selection, toRemove);

      expect(result).toEqual(new Set(["a", "c"]));
    });

    it("does not mutate original set", () => {
      const original = new Set(["a", "b"]);
      removeFromSelection(original, ["a"]);

      expect(original).toEqual(new Set(["a", "b"]));
    });
  });

  describe("getSelectedImages", () => {
    const items = [
      { type: "separator", id: "sep1" },
      { type: "image", id: "img1" },
      { type: "image", id: "img2" },
      { type: "image", id: "img3" },
    ];

    it("returns only selected images", () => {
      const selection = new Set(["img1", "img3"]);

      const result = getSelectedImages(items, selection);

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.id)).toEqual(["img1", "img3"]);
    });

    it("excludes separators", () => {
      const selection = new Set(["sep1", "img1"]);

      const result = getSelectedImages(items, selection);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("img1");
    });
  });
});

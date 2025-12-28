/**
 * @fileoverview Unit tests for sequence-detector build-time functions.
 *
 * Tests the build-time sequence detection and classification functions.
 */

import { describe, expect, it } from "vitest";
import {
  classifyMediaType,
  detectSequences,
  filterRepresentativeImages,
} from "../../../../scripts/lib/image/sequence-detector";
import { createMockImage } from "../../../utils/gallery-test-utils";

describe("sequence-detector", () => {
  describe("classifyMediaType", () => {
    it("returns 'image' for regular filenames", () => {
      expect(classifyMediaType("2025-01-15-cebreus")).toBe("image");
      expect(classifyMediaType("photo-with-dashes")).toBe("image");
      expect(classifyMediaType("simple")).toBe("image");
    });

    it("returns 'sequence' for representative (last) sequence member", () => {
      expect(classifyMediaType("photo--zoom3from3")).toBe("sequence");
      expect(classifyMediaType("test--pan4from4")).toBe("sequence");
      expect(classifyMediaType("burst--burst5from5")).toBe("sequence");
    });

    it("returns 'sequence-member' for non-last sequence members", () => {
      expect(classifyMediaType("photo--zoom1from3")).toBe("sequence-member");
      expect(classifyMediaType("photo--zoom2from3")).toBe("sequence-member");
      expect(classifyMediaType("test--pan1from4")).toBe("sequence-member");
    });

    it("returns 'panorama' for pano suffix", () => {
      expect(classifyMediaType("landscape--pano")).toBe("panorama");
      expect(classifyMediaType("2025-01-15-cebreus--pano")).toBe("panorama");
    });

    it("handles all sequence types", () => {
      // All representative members
      expect(classifyMediaType("test--zoom3from3")).toBe("sequence");
      expect(classifyMediaType("test--pan3from3")).toBe("sequence");
      expect(classifyMediaType("test--burst3from3")).toBe("sequence");
      expect(classifyMediaType("test--tl24from24")).toBe("sequence");
      expect(classifyMediaType("test--focus5from5")).toBe("sequence");
    });
  });

  describe("detectSequences", () => {
    it("returns empty map for images without sequences", () => {
      const images = [createMockImage({ id: "photo-1" }), createMockImage({ id: "photo-2" })];

      const result = detectSequences(images);
      expect(result.size).toBe(0);
    });

    it("detects sequence members and groups them", () => {
      const images = [
        createMockImage({ id: "test--zoom1from3" }),
        createMockImage({ id: "test--zoom2from3" }),
        createMockImage({ id: "test--zoom3from3" }),
      ];

      const result = detectSequences(images);

      expect(result.size).toBe(3);
      expect(result.get("test--zoom1from3")).toMatchObject({
        type: "zoom",
        index: 1,
        total: 3,
        baseId: "test",
      });
      expect(result.get("test--zoom3from3")?.members).toEqual([
        "test--zoom1from3",
        "test--zoom2from3",
        "test--zoom3from3",
      ]);
    });

    it("handles multiple separate sequences", () => {
      const images = [
        createMockImage({ id: "seq1--zoom1from2" }),
        createMockImage({ id: "seq1--zoom2from2" }),
        createMockImage({ id: "seq2--pan1from3" }),
        createMockImage({ id: "seq2--pan2from3" }),
        createMockImage({ id: "seq2--pan3from3" }),
      ];

      const result = detectSequences(images);

      expect(result.size).toBe(5);

      // Check seq1 members
      const seq1Info = result.get("seq1--zoom1from2");
      expect(seq1Info?.members).toHaveLength(2);

      // Check seq2 members
      const seq2Info = result.get("seq2--pan1from3");
      expect(seq2Info?.members).toHaveLength(3);
    });

    it("handles panoramas", () => {
      const images = [createMockImage({ id: "landscape--pano" })];

      const result = detectSequences(images);

      expect(result.size).toBe(1);
      expect(result.get("landscape--pano")).toMatchObject({
        type: "pano",
        index: 1,
        total: 1,
        baseId: "landscape",
      });
    });
  });

  describe("filterRepresentativeImages", () => {
    it("returns all regular images", () => {
      const images = [
        createMockImage({ id: "photo-1", type: "image" }),
        createMockImage({ id: "photo-2", type: "image" }),
      ];

      const result = filterRepresentativeImages(images);
      expect(result).toHaveLength(2);
    });

    it("returns panoramas", () => {
      const images = [createMockImage({ id: "pano--pano", type: "panorama" })];

      const result = filterRepresentativeImages(images);
      expect(result).toHaveLength(1);
    });

    it("returns sequence representatives but not members", () => {
      const images = [
        createMockImage({ id: "seq--zoom1from3", type: "sequence-member" }),
        createMockImage({ id: "seq--zoom2from3", type: "sequence-member" }),
        createMockImage({ id: "seq--zoom3from3", type: "sequence" }),
      ];

      const result = filterRepresentativeImages(images);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("seq--zoom3from3");
    });

    it("handles mixed content correctly", () => {
      const images = [
        createMockImage({ id: "photo-1", type: "image" }),
        createMockImage({ id: "seq--zoom1from2", type: "sequence-member" }),
        createMockImage({ id: "seq--zoom2from2", type: "sequence" }),
        createMockImage({ id: "pano--pano", type: "panorama" }),
      ];

      const result = filterRepresentativeImages(images);

      expect(result).toHaveLength(3);
      expect(result.map((img) => img.id)).toEqual(["photo-1", "seq--zoom2from2", "pano--pano"]);
    });
  });
});

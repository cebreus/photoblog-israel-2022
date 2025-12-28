/**
 * @fileoverview Unit tests for fancybox integration utilities.
 *
 * Tests the helper functions used in fancybox sequence integration.
 * Note: Full integration tests with actual Fancybox require E2E testing.
 */

import { describe, expect, it } from "vitest";
import {
  getSequenceMembers,
  isRepresentative,
  isSequenceMember,
  parseSequenceSuffix,
} from "$lib/utils/sequences";
import { createMockPanorama, createMockSequence } from "../../../utils/gallery-test-utils";

describe("fancybox sequence utilities", () => {
  describe("sequence member detection for lightbox", () => {
    it("identifies sequence images by -- pattern", () => {
      expect(isSequenceMember("photo--zoom1from3")).toBe(true);
      expect(isSequenceMember("photo--pano")).toBe(true);
      expect(isSequenceMember("regular-photo")).toBe(false);
    });

    it("identifies representative images for grid display", () => {
      expect(isRepresentative("photo--zoom3from3")).toBe(true);
      expect(isRepresentative("photo--zoom1from3")).toBe(false);
      expect(isRepresentative("photo--pano")).toBe(true);
    });
  });

  describe("sequence member collection for player", () => {
    it("collects all members of a zoom sequence", () => {
      const allImages = [
        ...createMockSequence("sunset", "zoom", 4),
        ...createMockSequence("other", "pan", 2),
      ];

      const members = getSequenceMembers(allImages, "sunset");

      expect(members).toHaveLength(4);
      expect(members[0].id).toBe("sunset--zoom1from4");
      expect(members[3].id).toBe("sunset--zoom4from4");
    });

    it("sorts members by index", () => {
      // Create out of order
      const allImages = [...createMockSequence("test", "burst", 3)].reverse(); // Reverse to make them out of order

      const members = getSequenceMembers(allImages, "test");

      expect(members[0].sequenceInfo?.index).toBe(1);
      expect(members[1].sequenceInfo?.index).toBe(2);
      expect(members[2].sequenceInfo?.index).toBe(3);
    });

    it("returns panorama as single member", () => {
      const pano = createMockPanorama("landscape");
      const allImages = [pano];

      const info = parseSequenceSuffix(pano.id);
      expect(info?.baseId).toBe("landscape");
      expect(info?.total).toBe(1);

      // Panorama is found when searching by baseId
      const members = getSequenceMembers(allImages, "landscape");
      expect(members).toHaveLength(1);
    });

    it("returns empty array for non-sequence baseId", () => {
      const allImages = createMockSequence("sunset", "zoom", 3);

      const members = getSequenceMembers(allImages, "nonexistent");

      expect(members).toHaveLength(0);
    });
  });

  describe("sequence info extraction for player props", () => {
    it("extracts zoom sequence info", () => {
      const info = parseSequenceSuffix("photo--zoom2from5");

      expect(info).toEqual({
        type: "zoom",
        index: 2,
        total: 5,
        baseId: "photo",
      });
    });

    it("extracts timelapse sequence info", () => {
      const info = parseSequenceSuffix("sunrise--tl12from24");

      expect(info).toEqual({
        type: "timelapse",
        index: 12,
        total: 24,
        baseId: "sunrise",
      });
    });

    it("extracts panorama info", () => {
      const info = parseSequenceSuffix("mountain--pano");

      expect(info).toEqual({
        type: "pano",
        index: 1,
        total: 1,
        baseId: "mountain",
      });
    });

    it("returns null for non-sequence images", () => {
      expect(parseSequenceSuffix("regular-photo")).toBeNull();
      expect(parseSequenceSuffix("photo-with-dashes")).toBeNull();
    });
  });
});

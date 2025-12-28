import { describe, expect, it } from "vitest";
import {
  getSequenceMembers,
  isRepresentative,
  isSequenceMember,
  parseSequenceSuffix,
} from "$lib/utils/sequences";

describe("sequences utilities", () => {
  describe("parseSequenceSuffix", () => {
    it("parses zoom suffix correctly", () => {
      const result = parseSequenceSuffix("2025-11-25-cebreus--zoom1from3");
      expect(result).toEqual({
        type: "zoom",
        index: 1,
        total: 3,
        baseId: "2025-11-25-cebreus",
      });
    });

    it("parses pan suffix correctly", () => {
      const result = parseSequenceSuffix("photo--pan2from4");
      expect(result).toEqual({
        type: "pan",
        index: 2,
        total: 4,
        baseId: "photo",
      });
    });

    it("parses timelapse suffix correctly", () => {
      const result = parseSequenceSuffix("sunset--tl5from12");
      expect(result).toEqual({
        type: "timelapse",
        index: 5,
        total: 12,
        baseId: "sunset",
      });
    });

    it("parses focus-stack suffix correctly", () => {
      const result = parseSequenceSuffix("macro--focus1from3");
      expect(result).toEqual({
        type: "focus-stack",
        index: 1,
        total: 3,
        baseId: "macro",
      });
    });

    it("returns null for regular images", () => {
      expect(parseSequenceSuffix("normal-photo")).toBeNull();
      expect(parseSequenceSuffix("2025-11-25-cebreus")).toBeNull();
      expect(parseSequenceSuffix("photo-with-dashes")).toBeNull();
    });

    it("parses single-file panorama suffix correctly", () => {
      const result = parseSequenceSuffix("2025-11-26-cebreus--pano");
      expect(result).toEqual({
        type: "pano",
        index: 1,
        total: 1,
        baseId: "2025-11-26-cebreus",
      });
    });

    it("returns null for malformed suffixes", () => {
      expect(parseSequenceSuffix("photo--zoom1")).toBeNull();
      expect(parseSequenceSuffix("photo--1from3")).toBeNull();
      expect(parseSequenceSuffix("photo--zoomfrom3")).toBeNull();
    });
  });

  describe("isSequenceMember", () => {
    it("returns true for sequence members", () => {
      expect(isSequenceMember("photo--zoom1from3")).toBe(true);
      expect(isSequenceMember("photo--pan2from4")).toBe(true);
      expect(isSequenceMember("photo--burst1from5")).toBe(true);
      expect(isSequenceMember("photo--pano")).toBe(true);
    });

    it("returns false for regular images", () => {
      expect(isSequenceMember("normal-photo")).toBe(false);
      expect(isSequenceMember("photo-with-dashes")).toBe(false);
    });
  });

  describe("isRepresentative", () => {
    it("returns true for last member of sequence", () => {
      expect(isRepresentative("photo--zoom3from3")).toBe(true);
      expect(isRepresentative("photo--pan4from4")).toBe(true);
      expect(isRepresentative("photo--burst5from5")).toBe(true);
      expect(isRepresentative("photo--pano")).toBe(true);
    });

    it("returns false for non-last members", () => {
      expect(isRepresentative("photo--zoom1from3")).toBe(false);
      expect(isRepresentative("photo--zoom2from3")).toBe(false);
      expect(isRepresentative("photo--pan1from4")).toBe(false);
    });

    it("returns false for regular images", () => {
      expect(isRepresentative("normal-photo")).toBe(false);
    });
  });

  describe("getSequenceMembers", () => {
    const mockImages = [
      { id: "2025-11-25--zoom1from3", title: "Zoom 1" },
      { id: "2025-11-25--zoom3from3", title: "Zoom 3" },
      { id: "2025-11-25--zoom2from3", title: "Zoom 2" },
      { id: "other-photo", title: "Other" },
      { id: "2025-11-26--pan1from2", title: "Pan 1" },
    ];

    it("returns all members of a sequence sorted by index", () => {
      const members = getSequenceMembers(mockImages, "2025-11-25");
      expect(members).toHaveLength(3);
      expect(members[0].id).toBe("2025-11-25--zoom1from3");
      expect(members[1].id).toBe("2025-11-25--zoom2from3");
      expect(members[2].id).toBe("2025-11-25--zoom3from3");
    });

    it("returns empty array for non-existent baseId", () => {
      const members = getSequenceMembers(mockImages, "non-existent");
      expect(members).toHaveLength(0);
    });

    it("excludes non-sequence images", () => {
      const members = getSequenceMembers(mockImages, "other-photo");
      expect(members).toHaveLength(0);
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  validateIgnoreFaceInput,
  validateMergeInput,
  validateReassignInput,
  validateUnmatchInput,
} from "$lib/utils/api-validators";

describe("api-validators", () => {
  describe("validateMergeInput", () => {
    it("should valid correct input", () => {
      const result = validateMergeInput({ sourcePersonId: "s1", targetPersonId: "t1" });
      expect(result.valid).toBe(true);
    });

    it("should fail for same ID", () => {
      const result = validateMergeInput({ sourcePersonId: "s1", targetPersonId: "s1" });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Nelze sloučit osobu se sebou samou");
      }
    });

    it("should fail for missing fields", () => {
      const result = validateMergeInput({ sourcePersonId: "s1" });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.status).toBe(400);
      }
    });

    it("should handle null body", () => {
      const result = validateMergeInput(null);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.status).toBe(400);
    });
  });

  describe("validateUnmatchInput", () => {
    it("should handle single imageId", () => {
      const result = validateUnmatchInput({ personId: "p1", imageId: "img1" });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.imageIds).toEqual(["img1"]);
    });

    it("should handle multiple imageIds", () => {
      const result = validateUnmatchInput({ personId: "p1", imageIds: ["img1", "img2"] });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.imageIds).toEqual(["img1", "img2"]);
    });

    it("should fail if both missing", () => {
      const result = validateUnmatchInput({ personId: "p1" });
      expect(result.valid).toBe(false);
    });
  });

  describe("validateIgnoreFaceInput", () => {
    it("should valid correct box", () => {
      const body = { personId: "p1", imageId: "i1", box: { x: 1, y: 1, width: 10, height: 10 } };
      const result = validateIgnoreFaceInput(body);
      expect(result.valid).toBe(true);
    });

    it("should fail for invalid box types", () => {
      const body = { personId: "p1", imageId: "i1", box: { x: "1", y: 1, width: 10, height: 10 } };
      const result = validateIgnoreFaceInput(body);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateReassignInput", () => {
    it("should valid correct input", () => {
      const result = validateReassignInput({
        sourcePersonId: "s1",
        targetPersonId: "t1",
        imageIds: ["i1"],
      });
      expect(result.valid).toBe(true);
    });

    it("should fail for empty imageIds", () => {
      const result = validateReassignInput({
        sourcePersonId: "s1",
        targetPersonId: "t1",
        imageIds: [],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("validateUnmatchInput additional", () => {
    it("should fail for empty imageIds", () => {
      expect(validateUnmatchInput({ personId: "p1", imageIds: [] }).valid).toBe(false);
      expect(validateUnmatchInput({ personId: "p1", imageIds: [1] }).valid).toBe(false);
    });
  });
});

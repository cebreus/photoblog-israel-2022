import { describe, expect, it } from "vitest";
import {
  validateIgnoreFaceInput,
  validateIgnoreInput,
  validateMarkAsJunkInput,
  validateMergeInput,
  validateReassignInput,
  validateRenameInput,
  validateUnmatchInput,
  validateUpdateCategoryInput,
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
  });

  describe("validateRenameInput", () => {
    it("should valid and sanitize name", () => {
      const result = validateRenameInput({ personId: "p1", name: "  New Name  " });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.name).toBe("New Name");
    });

    it("should fail for illegal characters", () => {
      const result = validateRenameInput({ personId: "p1", name: "Alice/Bob" });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("nepovolené znaky");
      }
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

  describe("validateUpdateCategoryInput", () => {
    it("should valid statue category", () => {
      const result = validateUpdateCategoryInput({ personId: "p1", category: "statue" });
      expect(result.valid).toBe(true);
    });

    it("should fail for invalid category", () => {
      const result = validateUpdateCategoryInput({ personId: "p1", category: "dog" });
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

  describe("edge cases", () => {
    it("should handle null body", () => {
      const result = validateMergeInput(null);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.status).toBe(400);
    });

    it("should handle non-object body", () => {
      const result = validateRenameInput("invalid");
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.status).toBe(400);
    });
  });

  describe("validateMarkAsJunkInput", () => {
    it("should valid correct input", () => {
      const result = validateMarkAsJunkInput({ personId: "p1" });
      expect(result.valid).toBe(true);
    });

    it("should fail for missing personId", () => {
      const result = validateMarkAsJunkInput({});
      expect(result.valid).toBe(false);
    });
  });

  describe("validateIgnoreInput", () => {
    it("should valid correct ignore input", () => {
      const result = validateIgnoreInput({ personId: "p1", ignored: true });
      expect(result.valid).toBe(true);
    });

    it("should fail for invalid types", () => {
      expect(validateIgnoreInput({ personId: 1, ignored: true }).valid).toBe(false);
      expect(validateIgnoreInput({ personId: "p1", ignored: "true" }).valid).toBe(false);
    });
  });

  describe("validateUnmatchInput additional", () => {
    it("should fail for empty imageIds", () => {
      expect(validateUnmatchInput({ personId: "p1", imageIds: [] }).valid).toBe(false);
      expect(validateUnmatchInput({ personId: "p1", imageIds: [1] }).valid).toBe(false);
    });
  });
});

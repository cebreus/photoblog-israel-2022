import { describe, expect, it } from "vitest";
import type { CollageRequest } from "../../../../src/lib/types/collage";
import { getCollageSourceIds, isCollage } from "../../../../src/lib/utils/collage-config";

describe("collage-config utilities", () => {
  describe("isCollage", () => {
    it("should match preferred double-hyphen suffix", () => {
      expect(isCollage("image--collage")).toBe(true);
      expect(isCollage("image--collage.jpg")).toBe(true);
      expect(isCollage("image--collage.JPEG")).toBe(true);
    });

    it("should match slugified single-hyphen suffix for backward compatibility", () => {
      expect(isCollage("image-collage")).toBe(true);
      expect(isCollage("image-collage.jpg")).toBe(true);
    });

    it("should not match unrelated strings", () => {
      expect(isCollage("image")).toBe(false);
      expect(isCollage("collage-image")).toBe(false);
      expect(isCollage("some-collage-stuff")).toBe(false);
    });
  });

  describe("getCollageSourceIds", () => {
    it("should extract IDs from config items", () => {
      const mockConfig: CollageRequest = {
        items: [
          { imageId: "img1", originalPath: "pics/img1.jpg" },
          { imageId: "img2", movedPath: "pics/collage-sources/img2.jpg" },
        ],
        template: "row",
      };

      const ids = getCollageSourceIds(mockConfig);
      expect(ids).toEqual(["img1", "img2"]);
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { getSources } from "../../src/lib/utils/images";
import type { ImageEntry } from "../../src/lib/types/manifest";

// Mock the manifest import
vi.mock("$manifests/images.manifest.json", () => ({
  default: { photoDays: [] },
}));
vi.mock("$manifests/curation.manifest.json", () => ({
  default: {},
}));

describe("images utils", () => {
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
            variant: "small",
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
        placeholderColor: "",
        exif: {},
        analysis: {},
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
  });
});

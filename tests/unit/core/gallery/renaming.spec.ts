import { describe, expect, it } from "vitest";
import { getNewBasename } from "../../../../scripts/lib/gallery/renaming";

describe("renaming utils", () => {
  describe("getNewBasename", () => {
    it("should generate name from EXIF date and author", () => {
      const tags = {
        DateTimeOriginal: new Date(Date.UTC(2025, 10, 23, 21, 52, 55)),
        Artist: "Bobo",
      } as any;
      const name = getNewBasename(tags, "default");
      expect(name).toBe("2025-11-23-215255-bobo");
    });

    it("should use default author if missing in EXIF", () => {
      const tags = {
        DateTimeOriginal: new Date(Date.UTC(2025, 10, 23, 21, 52, 55)),
      } as any;
      const name = getNewBasename(tags, "cebreus");
      expect(name).toBe("2025-11-23-215255-cebreus");
    });

    it("should use manifest author fallback if missing in EXIF", () => {
      const tags = {
        DateTimeOriginal: new Date(Date.UTC(2025, 10, 23, 21, 52, 55)),
      } as any;
      // fallback "Bobo" from manifest
      const name = getNewBasename(tags, "cebreus", "oldName", "Bobo");

      // Manifest author takes precedence over defaultAuthor when EXIF is missing?
      // Wait, let's check code logic:
      // if (metaAuthor) { ... } else if (manifestAuthor) { author = manifestAuthor }
      // AND THEN author = defaultAuthor was set initially.
      // So yes, manifestAuthor overwrites defaultAuthor.

      expect(name).toBe("2025-11-23-215255-bobo");
    });

    it("should keep suffix", () => {
      const tags = {
        DateTimeOriginal: new Date(Date.UTC(2025, 10, 23, 21, 52, 55)),
        Artist: "Bobo",
      } as any;
      const name = getNewBasename(tags, "default", "oldBase--collage");
      expect(name).toBe("2025-11-23-215255-bobo--collage");
    });

    it("should throw error if no date", () => {
      const tags = {} as any;
      expect(() => getNewBasename(tags, "default")).toThrow("Missing creation date");
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildImageEntry } from "../../scripts/lib/metadata";

// We need to mock 'sharp' metadata structure if we pass it,
// but buildImageEntry logic is mostly string normalization and EXIF mapping.

describe("image-processor logic", () => {
  describe("buildImageEntry", () => {
    // Helper to call it with minimal props
    const callCreate = async (exif: any) => {
      return buildImageEntry(
        "test-image",
        "/abs/path/to/test-image.jpg",
        exif,
        { width: 1000, height: 800 } as any, // originalMeta
        "#000000",
        1.5, // sizeMB
      );
    };

    it("normalizes canonical fields correctly", async () => {
      const result = await callCreate({
        Title: "My Title",
        Author: "John Doe",
        City: "Prague",
      });

      expect(result.title).toBe("My Title");
      expect(result.author).toBe("John Doe");
      expect(result.city).toBe("Prague");
      expect(result.id).toBe("test-image");
    });

    it("prefers ObjectName over Title if Title missing", async () => {
      const result = await callCreate({ ObjectName: "Object Name" });
      expect(result.title).toBe("Object Name");
    });

    it("calculates aspect ratio name", async () => {
      const result = await callCreate({});
      // 1000/800 = 1.25 = 5:4 -> landscape-5-4 ? or just landscape?
      // getAspectRatioName implementation details:
      // usually checks strictly.
      expect(result.aspectRatio).toBe("landscape-5-4");
    });

    it("handles keywords extraction", async () => {
      const result = await callCreate({
        Keywords: ["nature", "sunset"],
      });
      expect(result.keywords).toEqual(["nature", "sunset"]);
    });

    it("generates date string", async () => {
      const d = new Date("2022-01-01T12:00:00Z");
      const result = await callCreate({ DateTimeOriginal: d });
      expect(result.date).toBe(d.toISOString());
    });
  });
});

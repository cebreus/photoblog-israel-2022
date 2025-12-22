/**
 * @fileoverview Metadata Extraction Unit Tests
 *
 * @description
 * Tests the extraction of metadata from image files.
 * Verifies parsing of EXIF and IPTC data, including dates, GPS coordinates,
 * and custom tags using `exiftool`.
 *
 * @modules-tested
 * - scripts/lib/metadata.ts
 */

import { describe, expect, it } from "vitest";
import { buildImageEntry, normalizeExifData, type RawExifData } from "../../scripts/lib/metadata";

describe("Metadata Module (Unit)", () => {
  describe("normalizeExifData", () => {
    it("extracts canonical fields correctly", () => {
      const input: any = {
        Title: "My Title",
        "dc:creator": "John Doe",
        GPSLatitude: 32.5,
        GPSLongitude: 35.1,
        Keywords: ["tag1", "tag2"],
      };

      const result = normalizeExifData(input);

      expect(result.Title).toBe("My Title");
      expect(result["dc:creator"]).toBe("John Doe");
      expect(result.latitude).toBe(32.5);
      expect(result.longitude).toBe(35.1);
      // Casting result to any because RawExifData definition in test scope might miss dynamic keywords attachment if typed strictly
      expect((result as any).keywords).toEqual(["tag1", "tag2"]);
    });

    it("handles array values for creators", () => {
      const input: any = {
        "dc:creator": ["Jane Doe", "Second Author"],
      };
      const result = normalizeExifData(input);
      expect(result["dc:creator"]).toEqual(["Jane Doe", "Second Author"]);
      // Logic for "Author" field uses getStandardValue which takes first
      expect(result.Author).toBe("Jane Doe");
    });
  });

  describe("buildImageEntry", () => {
    it("constructs a valid ImageEntry", () => {
      const rawExif: Partial<RawExifData> = {
        Title: "Test Image",
        Author: "Tester",
        latitude: 10,
        longitude: 20,
      };
      const meta = { width: 1000, height: 800 };
      const analysis = { sharpness: 10, phash: "abc" };

      const entry = buildImageEntry(
        "test-image",
        "/abs/path/to/test-image.jpg",
        rawExif,
        meta,
        "rgb(0,0,0)",
        1.5,
        analysis,
      );

      expect(entry.id).toBe("test-image");
      expect(entry.title).toBe("Test Image");
      expect(entry.author).toBe("Tester");
      expect(entry.width).toBe(1000);
      expect(entry.aspectRatio).toBe("landscape-5-4");
      expect(entry.analysis?.sharpness).toBe(10);
      expect(entry.exif?.latitude).toBe(10);
      expect(entry.googleMapsUrl).toContain("10,20");
    });
  });
});

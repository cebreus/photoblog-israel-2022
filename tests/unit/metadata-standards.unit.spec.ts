import { describe, expect, it } from "vitest";
import {
  getExifToolWriteTags,
  METADATA_STANDARDS,
  type MetadataKey,
} from "../../src/lib/utils/metadata-standards";

describe("Metadata Standards", () => {
  it("defines read and write mappings for all keys", () => {
    const keys: MetadataKey[] = [
      "title",
      "caption",
      "keywords",
      "author",
      "location",
      "city",
      "state",
      "country",
      "countryCode",
    ];

    for (const key of keys) {
      const config = METADATA_STANDARDS[key];
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.read.length).toBeGreaterThan(0);
      expect(config.write.length).toBeGreaterThan(0);
    }
  });

  describe("getExifToolWriteTags", () => {
    it("generates correct tags for a single field update", () => {
      const updates = { title: "My Title" };
      const tags = getExifToolWriteTags(updates);

      // Should write to XMP, IPTC, and Exif as defined
      expect(tags["XMP:Title"]).toBe("My Title");
      expect(tags["IPTC:ObjectName"]).toBe("My Title");
      expect(tags["Exif:ImageDescription"]).toBe("My Title");
    });

    it("generates correct tags for multiple field updates", () => {
      const updates = {
        author: "John Doe",
        city: "Prague",
      };
      const tags = getExifToolWriteTags(updates);

      // Author
      expect(tags["XMP:Creator"]).toBe("John Doe");
      expect(tags["IPTC:By-line"]).toBe("John Doe");
      expect(tags["IFD0:Artist"]).toBe("John Doe");

      // City
      expect(tags["XMP:City"]).toBe("Prague");
      expect(tags["IPTC:City"]).toBe("Prague");
    });

    it("handles null values (clearing metadata)", () => {
      const updates = { title: null };
      const tags = getExifToolWriteTags(updates);

      expect(tags["XMP:Title"]).toBeNull();
      expect(tags["IPTC:ObjectName"]).toBeNull();
      expect(tags["Exif:ImageDescription"]).toBeNull();
    });

    it("ignores undefined keys in input (partial updates)", () => {
      const updates = {
        title: "New Title",
        author: undefined, // Should be ignored
      };
      const tags = getExifToolWriteTags(updates);

      expect(tags["XMP:Title"]).toBe("New Title");
      expect(tags).not.toHaveProperty("XMP:Creator");
    });
  });
});

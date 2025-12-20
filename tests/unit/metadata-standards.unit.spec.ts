import { describe, expect, it } from "vitest";
import { getExifToolWriteTags } from "$lib/utils/metadata-standards";

describe("metadata-standards: getExifToolWriteTags", () => {
  it("should convert simple updates to multiple EXIF/XMP/IPTC tags", () => {
    const updates = { title: "Test Title", author: "Antigravity", caption: "Test Caption" };
    const tags = getExifToolWriteTags(updates);

    expect(tags["XMP:Title"]).toBe("Test Title");
    expect(tags["IPTC:ObjectName"]).toBe("Test Title");
    // Title should NOT affect Exif:ImageDescription anymore
    expect(tags["Exif:ImageDescription"]).toBe("Test Caption");

    expect(tags["XMP:Description"]).toBe("Test Caption");
    expect(tags["IPTC:Caption-Abstract"]).toBe("Test Caption");

    expect(tags["XMP:Creator"]).toBe("Antigravity");
    expect(tags["IPTC:By-line"]).toBe("Antigravity");
    expect(tags["IFD0:Artist"]).toBe("Antigravity");
    expect(tags["IPTC:CodedCharacterSet"]).toBe("UTF8");
  });

  it("should handle null values for clearing tags", () => {
    const tags = getExifToolWriteTags({ city: null });
    expect(tags["XMP:City"]).toBe(null);
    expect(tags["IPTC:City"]).toBe(null);
  });

  it("should ignore undefined keys", () => {
    const tags = getExifToolWriteTags({ title: "ok", nonExistent: "ignore" } as any);
    expect(tags).not.toHaveProperty("nonExistent");
    expect(tags["XMP:Title"]).toBe("ok");
  });

  it("should handle array values (keywords)", () => {
    const tags = getExifToolWriteTags({ keywords: ["k1", "k2"] });
    expect(tags["XMP:Subject"]).toEqual(["k1", "k2"]);
    expect(tags["IPTC:Keywords"]).toEqual(["k1", "k2"]);
  });
});

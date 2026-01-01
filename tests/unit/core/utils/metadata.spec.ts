import { describe, expect, it } from "vitest";
import { formatMetadataForClipboard } from "$lib/utils/metadata";
import type { ImageEntry } from "$shared/types/manifest";

describe("formatMetadataForClipboard", () => {
  it("formats standard metadata correctly", () => {
    const item = {
      src: "content/israel-2022/IMG_1234.jpg",
      date: "2023-10-07T14:30:00.000Z",
      location: "Old City",
      city: "Jerusalem",
      exif: {
        country: "Israel",
        latitude: 31.7767,
        longitude: 35.2345,
      },
      // These should be IGNORED
      caption: "A beautiful confusing caption",
      keywords: ["confusing", "ai"],
    } as unknown as ImageEntry;

    // Adjust for local time offset in test or use partial match if needed.
    // The utility uses local time construction (getFullYear etc).
    // Let's create a fixed date to text logic relative to system time if needed,
    // or just check the presence of the string structure.

    // Actually, `new Date("2023-10-07T14:30:00.000Z")` will use local timezone in the implementation file.
    // To make test robust strictly to the format logic, we can verify the parts we control (lines).

    const result = formatMetadataForClipboard(item);

    expect(result).toContain("File: IMG_1234.jpg");
    expect(result).toContain("Location: Old City, Jerusalem, Israel");
    expect(result).toContain("GPS: 31.7767, 35.2345");

    // Verify exclusion
    expect(result).not.toContain("confusing caption");
    expect(result).not.toContain("Keywords");
  });

  it("handles standard latitude/longitude on root object", () => {
    const item = {
      src: "img.jpg",
      latitude: 50.1,
      longitude: 14.4,
    } as unknown as ImageEntry;

    const result = formatMetadataForClipboard(item);
    expect(result).toContain("GPS: 50.1, 14.4");
  });

  it("omits missing fields", () => {
    const item = {
      src: "img.jpg",
      // No date, no location
    } as unknown as ImageEntry;

    const result = formatMetadataForClipboard(item);
    expect(result).toBe("File: img.jpg");
  });
});

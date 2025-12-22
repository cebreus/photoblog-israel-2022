/**
 * @fileoverview Metadata Clipboard Unit Tests
 *
 * @description
 * Tests the metadata clipboard functionality.
 * Verifies operations for copying and pasting metadata between images,
 * ensuring data integrity during the transfer.
 *
 * @modules-tested
 * - src/lib/utils/metadata-clipboard.ts
 */

import { describe, expect, it } from "vitest";
import { metadataClipboard } from "../../src/lib/stores/metadata-clipboard.svelte";
import type { ImageEntry } from "../../src/lib/types/manifest";

describe("metadataClipboard Store", () => {
  const mockImage: ImageEntry = {
    id: "test-img",
    type: "image",
    src: "test.jpg",
    title: "Test Title",
    alt: "Test Alt",
    author: "Test Author",
    location: "Test Location",
    city: "Test City",
    caption: "Test Caption",
    keywords: ["tag1", "tag2"],
    exif: {
      date: "2025-01-01",
      title: "Exif Title",
      state: "Test State",
      country: "Test Country",
      countryCode: "TC",
    },
    // Required fields for type satisfaction
    sources: [],
    width: 100,
    height: 100,
    sizeMB: 1,
    placeholderColor: "#000",
    analysis: { sharpness: 10, phash: "abc" },
  };

  it("starts empty", () => {
    expect(metadataClipboard.sourceImage).toBeNull();
    expect(metadataClipboard.data).toBeNull();
    expect(metadataClipboard.hasData).toBe(false);
  });

  it("copies metadata from an image", () => {
    metadataClipboard.copy(mockImage);

    expect(metadataClipboard.sourceImage).toEqual(mockImage);
    expect(metadataClipboard.data).toEqual({
      title: "Exif Title", // Comes from image.exif?.title
      author: "Test Author",
      location: "Test Location",
      city: "Test City",
      state: "Test State",
      country: "Test Country",
      countryCode: "TC",
      caption: "Test Caption",
      keywords: ["tag1", "tag2"],
    });

    expect(metadataClipboard.hasData).toBe(true);
  });

  it("clears the clipboard", () => {
    metadataClipboard.copy(mockImage);
    expect(metadataClipboard.hasData).toBe(true); // Pre-check

    metadataClipboard.clear();

    expect(metadataClipboard.sourceImage).toBeNull();
    expect(metadataClipboard.data).toBeNull();
    expect(metadataClipboard.hasData).toBe(false);
  });
});

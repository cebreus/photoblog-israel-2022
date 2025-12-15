import { describe, it, expect, vi } from "vitest";
import {
  filterGalleryItems,
  computeTotals,
  mergeSparseDays,
} from "../../src/lib/utils/gallery";
import type {
  PhotoDay,
  ImageEntry,
  Separator,
} from "../../src/lib/types/manifest";

// Mock the manifest imports that might be triggered by indirect dependencies
vi.mock("$manifests/images.manifest.json", () => ({
  default: { photoDays: [] },
}));
vi.mock("$manifests/curation.manifest.json", () => ({
  default: {},
}));

describe("gallery utils", () => {
  const mockImage1 = {
    type: "image",
    id: "img1",
    authorSlug: "author1",
    location: "LocA",
  } as ImageEntry;

  const mockImage2 = {
    type: "image",
    id: "img2",
    authorSlug: "author2",
    location: "LocA",
  } as ImageEntry;

  const mockImage3 = {
    type: "image",
    id: "img3",
    authorSlug: "author1",
    location: "LocB",
  } as ImageEntry;

  const mockSeparator = {
    type: "separator",
    id: "sep1",
    location: "LocA",
  } as Separator;

  describe("filterGalleryItems", () => {
    const items = [mockImage1, mockImage2, mockSeparator];

    it("returns all items when no filters applied", () => {
      expect(filterGalleryItems(items, [], true)).toEqual(items);
    });

    it("filters by author", () => {
      const result = filterGalleryItems(items, ["author1"], true);
      expect(result).toContain(mockImage1);
      expect(result).not.toContain(mockImage2);
      expect(result).toContain(mockSeparator); // Separators kept if showSeparators=true
    });

    it("hides separators if showSeparators is false", () => {
      const result = filterGalleryItems(items, [], false);
      expect(result).toContain(mockImage1);
      expect(result).toContain(mockImage2);
      expect(result).not.toContain(mockSeparator);
    });
  });

  describe("computeTotals", () => {
    const day1: PhotoDay = {
      date: "2022-01-01",
      id: "d1",
      items: [mockImage1, mockImage2, mockSeparator],
    };
    const day2: PhotoDay = {
      date: "2022-01-02",
      id: "d2",
      items: [mockImage3],
    };

    it("computes correctly for all items", () => {
      const { visiblePhotos, totalLocations } = computeTotals([], true, [
        day1,
        day2,
      ]);
      expect(visiblePhotos).toBe(3); // img1, img2, img3
      expect(totalLocations).toBe(2); // LocA, LocB
    });

    it("computes filtered totals", () => {
      // Filter author1 (img1, img3)
      const { visiblePhotos, totalLocations } = computeTotals(
        ["author1"],
        true,
        [day1, day2],
      );
      expect(visiblePhotos).toBe(2);
      // LocA (from img1), LocB (from img3). separator (LocA) still there.
      expect(totalLocations).toBe(2);
    });
  });

  describe("mergeSparseDays", () => {
    const sparseDay1: PhotoDay = {
      date: "2022-01-01",
      id: "d1",
      items: [mockImage1], // 1 image
      cities: ["City1"],
      locations: ["Loc1"],
    };
    const sparseDay2: PhotoDay = {
      date: "2022-01-02",
      id: "d2",
      items: [mockImage2, mockSeparator], // 1 image + separator
      cities: ["City2"],
      locations: ["Loc2"],
    };
    const fullDay: PhotoDay = {
      date: "2022-01-03",
      id: "d3",
      items: [mockImage1, mockImage2, mockImage3], // 3 images
    };

    it("merges consecutive sparse days", () => {
      const input = [sparseDay1, sparseDay2, fullDay];
      const result = mergeSparseDays(input);

      expect(result).toHaveLength(2);

      // First item should be the merged day
      const merged = result[0];
      expect(merged.mergedDates).toEqual(["2022-01-01", "2022-01-02"]);
      expect(merged.items).toHaveLength(3); // 1 + 2 items
      expect(merged.cities).toEqual(expect.arrayContaining(["City1", "City2"]));

      // Second item should be the full day intact
      expect(result[1]).toBe(fullDay);
    });

    it("does not merge a single sparse day at the end", () => {
      // Logika `flushMerge` říká: if pendingMerge.length === 1 -> push as is.
      // Takže osamocený sparse day se nemergujue sám do sebe (nevzniká mergedDates)
      const input = [fullDay, sparseDay1];
      const result = mergeSparseDays(input);

      expect(result).toHaveLength(2);
      expect(result[1]).toBe(sparseDay1);
      expect(result[1].mergedDates).toBeUndefined();
    });

    it("merges three sparse days", () => {
      const sparseDay3 = { ...sparseDay1, date: "2022-01-04" };
      const result = mergeSparseDays([sparseDay1, sparseDay2, sparseDay3]);
      expect(result).toHaveLength(1);
      expect(result[0].mergedDates).toHaveLength(3);
    });
  });
});

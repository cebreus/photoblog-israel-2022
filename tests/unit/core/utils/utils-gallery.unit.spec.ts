import { describe, expect, it } from "vitest";
import type { ImageEntry, PhotoDay, QualityBucket, Separator } from "$lib/types/manifest";
import { computeTotals, filterGalleryItems } from "$lib/utils/gallery";

describe("gallery utils", () => {
  const mockImage1: ImageEntry = {
    type: "image",
    id: "img1",
    authorSlug: "author1",
    src: "img1.jpg",
    variants: [],
    analysis: { qualityBucket: "excellent" },
    people: [],
  } as unknown as ImageEntry;

  const mockImage2: ImageEntry = {
    type: "image",
    id: "img2",
    authorSlug: "author2",
    src: "img2.jpg",
    variants: [],
    analysis: { qualityBucket: "good" },
    people: [],
    location: "LocB",
  } as unknown as ImageEntry;

  const mockSeparator = {
    type: "separator",
    id: "sep1",
    location: "LocA",
  } as Separator;

  const defaultCriteria = {
    selectedAuthors: [],
    showSeparators: true,
    selectedQualityBuckets: [],
    selectedPeople: [],
    selectedMediaTypes: [],
    showOthersSnapshots: true,
    showAuthorSnapshots: true,
    onlySnapshots: false,
  };

  describe("filterGalleryItems", () => {
    const items = [mockImage1, mockImage2, mockSeparator];

    it("returns all items when no filters applied", () => {
      expect(filterGalleryItems(items, defaultCriteria)).toEqual(items);
    });

    it("filters by author", () => {
      const result = filterGalleryItems(items, {
        ...defaultCriteria,
        selectedAuthors: ["author1"],
      });
      expect(result).toContain(mockImage1);
      expect(result).not.toContain(mockImage2);
      expect(result).toContain(mockSeparator); // Separators kept if showSeparators=true
    });

    it("hides separators if showSeparators is false", () => {
      const result = filterGalleryItems(items, { ...defaultCriteria, showSeparators: false });
      expect(result).toContain(mockImage1);
      expect(result).toContain(mockImage2);
      expect(result).not.toContain(mockSeparator);
    });

    it("hides all items if aesthetic buckets is explicitly ['none']", () => {
      const result = filterGalleryItems(items, {
        ...defaultCriteria,
        selectedQualityBuckets: ["none"] as unknown as QualityBucket[],
      });
      const images = result.filter((i) => i.type === "image");
      expect(images).toHaveLength(0);
    });

    it("shows all items if quality bucket is empty (Empty = All)", () => {
      const result = filterGalleryItems(items, { ...defaultCriteria, selectedQualityBuckets: [] });
      const images = result.filter((i) => i.type === "image");
      expect(images).toHaveLength(2);
    });

    it("shows all items if all buckets are selected explicitly", () => {
      const allBuckets = ["excellent", "good", "poor"] as QualityBucket[];
      const result = filterGalleryItems(items, {
        ...defaultCriteria,
        selectedQualityBuckets: allBuckets,
      });
      expect(result).toContain(mockImage1);
      expect(result).toContain(mockImage2);
    });

    it("filters by people - shows images with selected people", () => {
      const imgWithPeople = {
        ...mockImage1,
        people: ["person1", "person2"],
      } as ImageEntry;
      const imgWithoutPeople = {
        ...mockImage2,
        people: [],
      } as ImageEntry;

      const result = filterGalleryItems([imgWithPeople, imgWithoutPeople], {
        ...defaultCriteria,
        selectedPeople: ["person1"],
      });

      expect(result).toContain(imgWithPeople);
      expect(result).not.toContain(imgWithoutPeople);
    });

    it("filters by quality - missing analysis/bucket (line 106 branch)", () => {
      const imgNoAnalysis = { ...mockImage1, analysis: undefined } as ImageEntry;
      // When quality filter is active (not default []), images without analysis are hidden
      const result = filterGalleryItems([imgNoAnalysis], {
        ...defaultCriteria,
        selectedQualityBuckets: ["excellent"],
      });
      expect(result).not.toContain(imgNoAnalysis);
    });

    it("filters exclusively for snapshots when onlySnapshots is true", () => {
      const snap = { ...mockImage1, flags: ["snapshot-author"] } as ImageEntry;
      const normal = { ...mockImage2, flags: [] } as ImageEntry;
      const result = filterGalleryItems([snap, normal], {
        ...defaultCriteria,
        onlySnapshots: true,
      });
      expect(result).toContain(snap);
      expect(result).not.toContain(normal);
    });
  });

  describe("computeTotals", () => {
    const day1: PhotoDay = {
      id: "day1",
      date: "2024-01-01",
      location: "LocA",
      items: [mockImage1, mockSeparator],
    } as unknown as PhotoDay;

    const day2: PhotoDay = {
      id: "day2",
      date: "2024-01-02",
      location: "LocB",
      items: [mockImage2, { ...mockImage1, id: "img3", location: "LocB" } as ImageEntry],
    } as unknown as PhotoDay;

    it("computes totals for all images and locations", () => {
      const { visiblePhotos, totalLocations } = computeTotals(defaultCriteria, [day1, day2]);
      expect(visiblePhotos).toBe(3); // img1, img2, img3
      expect(totalLocations).toBe(2); // LocA, LocB
    });

    it("computes filtered totals", () => {
      const { visiblePhotos, totalLocations } = computeTotals(
        { ...defaultCriteria, selectedAuthors: ["author1"] },
        [day1, day2],
      );
      expect(visiblePhotos).toBe(2); // img1, img3
      expect(totalLocations).toBe(2);
    });
  });
});

/**
 * @fileoverview Filter Utilities Unit Tests
 *
 * @description
 * Tests helper logic for filtering gallery items.
 * Verifies boolean logic for combining different filter criteria (authors, tags, camers, etc.)
 * to produce the final filtered set of images.
 *
 * @modules-tested
 * - src/lib/utils/filter-utils.ts
 */

import type { ImageEntry, PhotoDay, Separator } from "$lib/types/manifest";
import { computeTotals } from "$lib/utils/gallery";
import { describe, expect, it } from "vitest";

// Helper to create typed mock data
const mockDays: PhotoDay[] = [
  {
    date: "2022-01-01",
    id: "d1",
    items: [
      {
        type: "image",
        id: "i1",
        src: "a",
        author: "A",
        authorSlug: "a",
        sources: [],
        alt: "",
        title: "",
      } as ImageEntry,
      {
        type: "image",
        id: "i2",
        src: "b",
        author: "B",
        authorSlug: "b",
        sources: [],
        alt: "",
        title: "",
      } as ImageEntry,
      { type: "separator", id: "s1", location: "L1", city: "C1" } as Separator,
    ],
  },
  {
    date: "2022-01-02",
    id: "d2",
    items: [
      {
        type: "image",
        id: "i3",
        src: "c",
        author: "A",
        authorSlug: "a",
        sources: [],
        alt: "",
        title: "",
      } as ImageEntry,
      {
        type: "image",
        id: "i4",
        src: "d",
        author: undefined,
        sources: [],
        alt: "",
        title: "",
      } as ImageEntry,
      { type: "separator", id: "s2", location: "L2", city: "C2" } as Separator,
    ],
  },
];

// Helper to update mock images with analysis score
const withAnalysis = (item: any) => ({
  ...item,
  analysis: { aestheticScore: 0, qualityBucket: "good" },
});

// Update the items in mockDays
mockDays[0].items[0] = withAnalysis(mockDays[0].items[0]); // i1
mockDays[0].items[1] = withAnalysis(mockDays[0].items[1]); // i2
mockDays[1].items[0] = withAnalysis(mockDays[1].items[0]); // i3
mockDays[1].items[1] = withAnalysis(mockDays[1].items[1]); // i4

describe("computeTotals", () => {
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

  it("counts visible images given author slugs & separators", () => {
    // Update tests to use [] as default quality filter (all).
    const r1 = computeTotals({ ...defaultCriteria, selectedAuthors: ["a"] }, mockDays);
    expect(r1.visiblePhotos).toBe(4); // img1, img3 (author 'a'), sep1, sep2 (separators visible by default)

    const r2 = computeTotals(defaultCriteria, [mockDays[0]]);
    expect(r2.visiblePhotos).toBe(3); // img1, img2, sep1

    const r3 = computeTotals(
      { ...defaultCriteria, selectedAuthors: ["a"], showSeparators: false },
      mockDays,
    );
    expect(r3.visiblePhotos).toBe(2); // img1, img3 (author 'a'), separators hidden
  });

  it("handles explicit 'none' state", () => {
    // When author is 'none', it should hide images BUT keep separators if showSeparators=true
    const r = computeTotals({ ...defaultCriteria, selectedAuthors: ["none"] }, mockDays); // Changed [day1, day2] to mockDays
    expect(r.visiblePhotos).toBe(2); // Only valid images are hidden, separators remain (sep1, sep2)
  });

  it("matches selected slugs against image.authorSlug", () => {
    const mock: PhotoDay[] = [
      {
        date: "2022-01-01",
        id: "d1",
        items: [
          withAnalysis({
            type: "image",
            id: "i1",
            src: "a",
            author: "A",
            authorSlug: "a-slug",
            sources: [],
            alt: "",
            title: "",
          }) as ImageEntry,
        ],
      },
    ];

    // selecting by slug should match the image that has authorSlug
    const r = computeTotals({ ...defaultCriteria, selectedAuthors: ["a-slug"] }, mock);
    expect(r.visiblePhotos).toBe(1);
  });

  it("counts unique locations across days", () => {
    const r = computeTotals(defaultCriteria, mockDays);
    // locations: L1 and L2 (unique) => 2
    expect(r.totalLocations).toBe(2);
  });
});

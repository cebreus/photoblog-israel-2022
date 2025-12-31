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

import { describe, expect, it } from "vitest";
import type { ImageEntry, PhotoDay, Separator } from "$lib/types/manifest";
import { computeTotals } from "$lib/utils/gallery";

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
  it("counts visible images given author slugs & separators", () => {
    // Update tests to use [] as default quality filter (all).
    const r1 = computeTotals(["a"], true, [], [], [], true, true, false, mockDays);
    expect(r1.visiblePhotos).toBe(2);

    const r2 = computeTotals([], true, [], [], [], true, true, false, mockDays);
    expect(r2.visiblePhotos).toBe(4);

    const r3 = computeTotals(["a"], false, [], [], [], true, true, false, mockDays);
    expect(r3.visiblePhotos).toBe(2);
  });

  it("handles explicit 'none' state", () => {
    const r = computeTotals(["none"], true, [], [], [], true, true, false, mockDays);
    expect(r.visiblePhotos).toBe(0);
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
    const r = computeTotals(["a-slug"], true, [], [], [], true, true, false, mock);
    expect(r.visiblePhotos).toBe(1);
  });

  it("counts unique locations across days", () => {
    const r = computeTotals([], true, [], [], [], true, true, false, mockDays);
    // locations: L1 and L2 (unique) => 2
    expect(r.totalLocations).toBe(2);
  });
});

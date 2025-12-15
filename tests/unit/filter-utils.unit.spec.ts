import { describe, it, expect } from "vitest";
import { computeTotals } from "../../src/lib/utils/gallery";
import type {
  PhotoDay,
  ImageEntry,
  Separator,
} from "../../src/lib/types/manifest";

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
        alt: "", // Added property
        title: "", // Added property
      } as ImageEntry,
      {
        type: "image",
        id: "i2",
        src: "b",
        author: "B",
        authorSlug: "b",
        sources: [],
        alt: "", // Added property
        title: "", // Added property
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
        alt: "", // Added property
        title: "", // Added property
      } as ImageEntry,
      {
        type: "image",
        id: "i4",
        src: "d",
        author: undefined,
        sources: [],
        alt: "", // Added property
        title: "", // Added property
      } as ImageEntry,
      { type: "separator", id: "s2", location: "L2", city: "C2" } as Separator,
    ],
  },
];

describe("computeTotals", () => {
  it("counts visible images given author slugs & separators", () => {
    // Update tests to use slug-first author selection. Images include top-level
    // author and authorSlug fields in the manifest; filtering should match
    // when selecting slugs.
    const r1 = computeTotals(["a"], true, mockDays);
    // images by author 'a' (slug): i1, i3 => 2 (separators are not images)
    expect(r1.visiblePhotos).toBe(2);

    const r2 = computeTotals([], true, mockDays);
    // empty authors => IMPLICIT ALL => visible images should be 4 (i1, i2, i3, i4)
    expect(r2.visiblePhotos).toBe(4);

    const r3 = computeTotals(["a"], false, mockDays);
    // separators excluded doesn't affect image count (still 2)
    expect(r3.visiblePhotos).toBe(2);
  });

  it("handles explicit 'none' state", () => {
    const r = computeTotals(["none"], true, mockDays);
    // 'none' => explicit hide all => 0
    expect(r.visiblePhotos).toBe(0);
  });

  it("matches selected slugs against image.authorSlug", () => {
    const mock: PhotoDay[] = [
      {
        date: "2022-01-01",
        id: "d1",
        items: [
          {
            type: "image",
            id: "i1",
            src: "a",
            author: "A",
            authorSlug: "a-slug",
            sources: [],
            alt: "", // Added property
            title: "", // Added property
          } as ImageEntry,
        ],
      },
    ];

    // selecting by slug should match the image that has authorSlug
    const r = computeTotals(["a-slug"], true, mock);
    expect(r.visiblePhotos).toBe(1);
  });

  it("counts unique locations across days", () => {
    const r = computeTotals([], true, mockDays);
    // locations: L1 and L2 (unique) => 2
    expect(r.totalLocations).toBe(2);
  });
});

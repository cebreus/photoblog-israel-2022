import { describe, expect, it } from "vitest";
import type { ImageEntry, PhotoDayItem } from "$lib/types/manifest";
import { filterGalleryItems } from "$lib/utils/gallery";

describe("gallery filters - collage filtering", () => {
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

  it("should show collages when type=collage", () => {
    const items: PhotoDayItem[] = [
      {
        type: "collage",
        id: "2025-11-26-155237-cebreus--collage",
        src: "test.jpg",
        aspectRatio: "collage",
        alt: "",
        title: "",
        sources: [],
      } as ImageEntry,
    ];

    const result = filterGalleryItems(items, {
      ...defaultCriteria,
      selectedMediaTypes: ["collage"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2025-11-26-155237-cebreus--collage");
  });

  it("should show collages when type=image but aspectRatio=collage", () => {
    const items: PhotoDayItem[] = [
      {
        type: "image",
        id: "2025-11-24-205551-cebreus--collage",
        src: "test.jpg",
        aspectRatio: "collage",
        alt: "",
        title: "",
        sources: [],
      } as ImageEntry,
    ];

    const result = filterGalleryItems(items, {
      ...defaultCriteria,
      selectedMediaTypes: ["collage"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2025-11-24-205551-cebreus--collage");
  });

  it("should show collages when type=image but id contains --collage", () => {
    const items: PhotoDayItem[] = [
      {
        type: "image",
        id: "test--collage",
        src: "test.jpg",
        aspectRatio: "landscape-16-9",
        alt: "",
        title: "",
        sources: [],
      } as ImageEntry,
    ];

    const result = filterGalleryItems(items, {
      ...defaultCriteria,
      selectedMediaTypes: ["collage"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("test--collage");
  });

  it("should NOT show regular images when filtering for collages", () => {
    const items: PhotoDayItem[] = [
      {
        type: "image",
        id: "regular-image",
        src: "test.jpg",
        aspectRatio: "landscape-16-9",
        alt: "",
        title: "",
        sources: [],
      } as ImageEntry,
    ];

    const result = filterGalleryItems(items, {
      ...defaultCriteria,
      selectedMediaTypes: ["collage"],
    });

    expect(result).toHaveLength(0);
  });

  it("should show both collages and regular images when both are selected", () => {
    const items: PhotoDayItem[] = [
      {
        type: "collage",
        id: "test--collage",
        src: "collage.jpg",
        aspectRatio: "collage",
        alt: "",
        title: "",
        sources: [],
      } as ImageEntry,
      {
        type: "image",
        id: "regular-image",
        src: "regular.jpg",
        aspectRatio: "landscape-16-9",
        alt: "",
        title: "",
        sources: [],
      } as ImageEntry,
    ];

    const result = filterGalleryItems(items, {
      ...defaultCriteria,
      selectedMediaTypes: ["collage", "image"],
    });

    expect(result).toHaveLength(2);
  });

  it("should show panoramas when type=image but aspectRatio=panorama", () => {
    const items: PhotoDayItem[] = [
      {
        type: "image",
        id: "pano-test",
        src: "pano.jpg",
        aspectRatio: "panorama",
        alt: "",
        title: "",
        sources: [],
      } as ImageEntry,
    ];

    const result = filterGalleryItems(items, {
      ...defaultCriteria,
      selectedMediaTypes: ["panorama"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pano-test");
  });
});

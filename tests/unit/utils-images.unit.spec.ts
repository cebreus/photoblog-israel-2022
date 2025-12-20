import { describe, expect, it, vi } from "vitest";
import type { ImageEntry } from "$lib/types/manifest";
import { getImageById, getImagePeopleMap, getSources } from "$lib/utils/images";

vi.mock("$app/environment", () => ({ dev: false }));

// Mock manifests
vi.mock("$manifests/images.manifest.json", () => ({
  default: {
    photoDays: [
      {
        date: "2024-01-01",
        id: "day1",
        items: [
          { type: "image", id: "img1", src: "src1", alt: "alt1", sources: [], people: ["p1"] },
          { type: "image", id: "img2", src: "src2", alt: "alt2", sources: [] },
        ],
      },
    ],
  },
}));
vi.mock("$manifests/curation.manifest.json", () => ({ default: { groups: [] } }));
vi.mock("$manifests/people.manifest.json", () => ({ default: { people: [] } }));

describe("images utils", () => {
  it("getImageById should find image", () => {
    const img = getImageById("img1");
    expect(img).toBeDefined();
    expect(img?.id).toBe("img1");
  });

  it("getImageById should return undefined for missing image", () => {
    expect(getImageById("missing")).toBeUndefined();
  });

  it("getImagePeopleMap should build map", () => {
    const map = getImagePeopleMap();
    expect(map.img1).toEqual(["p1"]);
    expect(map.img2).toBeUndefined();
  });

  it("getSources should format sources and sort by priority", () => {
    const item: ImageEntry = {
      id: "i1",
      type: "image",
      src: "s1",
      alt: "a1",
      sources: [
        { type: "image/jpeg", path: "j1", width: 100 },
        { type: "image/webp", path: "w1", width: 100 },
        { type: "image/avif", path: "a1", width: 100 },
      ],
    } as any;

    const sources = getSources(item);
    expect(sources).toHaveLength(3);
    expect(sources[0].type).toBe("image/avif");
    expect(sources[1].type).toBe("image/webp");
    expect(sources[2].type).toBe("image/jpeg");
    expect(sources[0].srcset).toBe("a1 100w");
  });
});

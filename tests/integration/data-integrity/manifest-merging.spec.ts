import { describe, expect, it } from "vitest";
import { mergeManifests } from "$lib/utils/manifest-loader";
import { GalleryBuilder } from "../../fixtures/gallery-builder";

describe("Runtime Manifest Merging", () => {
  it("should merge detected faces into the image entry", () => {
    const builder = new GalleryBuilder();
    builder.addPhoto("img-1");
    builder.addFace("img-1", "person-1", { x: 10, y: 10, width: 50, height: 50 });

    const { manifest, facesManifest } = builder.build();

    // Verify initial state (builder adds it, but let's simulate clean slate)
    // The builder actually returns fully linked data in 'manifest' for convenience,
    // but here we want to test the MERGE function.
    // So let's strip the extra data from the input manifest first.
    const cleanManifest = structuredClone(manifest);
    const img = cleanManifest.photoDays[0].items[0];
    if (img.type === "image") {
      delete img.analysis;
      delete img.people;
    }

    const merged = mergeManifests(cleanManifest, facesManifest, null, null);
    const mergedImg = merged.photoDays[0].items[0];

    if (mergedImg.type !== "image") throw new Error("Expected image");

    expect(mergedImg.analysis).toBeDefined();
    expect(mergedImg.analysis?.facesDetected).toBe(true);
    expect(mergedImg.analysis?.faces).toHaveLength(1);
    expect(mergedImg.analysis?.faces?.[0]).toEqual({ x: 10, y: 10, width: 50, height: 50 });
    expect(mergedImg.people).toContain("person-1");
  });

  it("should merge AI analysis data", () => {
    const builder = new GalleryBuilder();
    builder.addPhoto("img-1"); // No analysis initially

    const { manifest } = builder.build();

    const analysisManifest = {
      "img-1": {
        sharpness: 90,
        aestheticScore: 5.5,
        phash: "aabbcc",
        qualityBucket: "good" as const,
      },
    };

    const merged = mergeManifests(manifest, null, analysisManifest, null);
    const mergedImg = merged.photoDays[0].items[0];

    if (mergedImg.type !== "image") throw new Error("Expected image");

    expect(mergedImg.analysis?.sharpness).toBe(90);
    expect(mergedImg.analysis?.aestheticScore).toBe(5.5);
    expect(mergedImg.analysis?.phash).toBe("aabbcc");
  });

  it("should handle missing manifests gracefully", () => {
    const builder = new GalleryBuilder();
    builder.addPhoto("img-1");
    const { manifest } = builder.build();

    const merged = mergeManifests(manifest, null, null, null);

    // Should return clone of original without errors
    expect(merged).toEqual(manifest);
  });
});

import { describe, expect, it } from "vitest";
import { GalleryBuilder } from "../../fixtures/gallery-builder";

/**
 * Tests the integrity of the "Split & Link" architecture.
 * Verifies that separately stored data (images, faces, analysis) correctly referencing each other.
 */
describe("Manifest Data Integrity", () => {
  it("should link detected faces to valid person IDs", () => {
    const builder = new GalleryBuilder();

    builder.addPerson("person-1", "Alice");
    builder.addPhoto("photo-1");
    builder.addFace("photo-1", "person-1", { x: 10, y: 10, width: 50, height: 50 });

    const { facesManifest, peopleManifest } = builder.build();
    const validPeopleIds = new Set(peopleManifest.people.map((p) => p.id));

    // Verify consistency
    const photoFaces = facesManifest["photo-1"];
    expect(photoFaces).toBeDefined();

    photoFaces.peopleIds.forEach((personId) => {
      expect(validPeopleIds.has(personId)).toBe(true);
    });
  });

  it("should detect orphaned face references (Simulation)", () => {
    // This test simulates a broken state to prove the test logic works
    const builder = new GalleryBuilder();

    builder.addPhoto("photo-1");
    // Add face for "person-X" who doesn't exist in peopleManifest
    builder.addFace("photo-1", "person-X", { x: 0, y: 0, width: 0, height: 0 });

    const { facesManifest, peopleManifest } = builder.build();
    const validPeopleIds = new Set(peopleManifest.people.map((p) => p.id));

    // Check for orphans
    const orphans: string[] = [];
    Object.values(facesManifest).forEach((img) => {
      img.peopleIds.forEach((pid) => {
        if (!validPeopleIds.has(pid)) orphans.push(pid);
      });
    });

    expect(orphans).toContain("person-X");
  });

  it("should Verify image IDs exist in all manifests", () => {
    const builder = new GalleryBuilder();
    const analysisData = { sharpness: 10, phash: "abc" };

    builder.addPhoto("photo-1", { analysis: analysisData });

    const { manifest, analysisManifest } = builder.build();

    // Get all image IDs from the main manifest
    const imageIds: string[] = [];
    manifest.photoDays.forEach((day) => {
      day.items.forEach((item) => {
        if (item.type === "image") imageIds.push(item.id);
      });
    });

    // Verify analysis exists for all
    imageIds.forEach((id) => {
      expect(analysisManifest[id]).toBeDefined();
      expect(analysisManifest[id].phash).toBe("abc");
    });
  });
});

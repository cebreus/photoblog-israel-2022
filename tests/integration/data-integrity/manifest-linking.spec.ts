import { describe, expect, it } from "vitest";
import { createGalleryBuilder } from "../../fixtures/gallery-builder";

/**
 * Tests the integrity of the "Split & Link" architecture.
 * Verifies that separately stored data (images, faces, analysis) correctly referencing each other.
 */
describe("Manifest Data Integrity", function testSuite() {
  it("should link detected faces to valid person IDs", function test() {
    const builder = createGalleryBuilder();

    builder.addPerson("person-1", "Alice");
    builder.addPhoto("photo-1");
    builder.addFace("photo-1", "person-1", { x: 10, y: 10, width: 50, height: 50 });

    const { facesManifest, peopleManifest } = builder.build();
    function getPersonId(p: { id: string }) {
      return p.id;
    }
    const validPeopleIds = new Set(peopleManifest.people.map(getPersonId));

    // Verify consistency
    const photoFaces = facesManifest["photo-1"];
    expect(photoFaces).toBeDefined();

    function checkPersonRef(personId: string) {
      expect(validPeopleIds.has(personId)).toBe(true);
    }
    photoFaces.peopleIds.forEach(checkPersonRef);
  });

  it("should detect orphaned face references (Simulation)", function test() {
    // This test simulates a broken state to prove the test logic works
    const builder = createGalleryBuilder();

    builder.addPhoto("photo-1");
    // Add face for "person-X" who doesn't exist in peopleManifest
    builder.addFace("photo-1", "person-X", { x: 0, y: 0, width: 0, height: 0 });

    const { facesManifest, peopleManifest } = builder.build();
    function getPersonId(p: { id: string }) {
      return p.id;
    }
    const validPeopleIds = new Set(peopleManifest.people.map(getPersonId));

    // Check for orphans
    const orphans: string[] = [];
    function checkOrphans(img: any) {
      function checkId(pid: string) {
        if (!validPeopleIds.has(pid)) orphans.push(pid);
      }
      img.peopleIds.forEach(checkId);
    }
    Object.values(facesManifest).forEach(checkOrphans);

    expect(orphans).toContain("person-X");
  });

  it("should Verify image IDs exist in all manifests", function test() {
    const builder = createGalleryBuilder();
    const analysisData = { sharpness: 10, phash: "abc" };

    builder.addPhoto("photo-1", { analysis: analysisData });

    const { manifest, analysisManifest } = builder.build();

    // Get all image IDs from the main manifest
    const imageIds: string[] = [];
    function collectIds(day: any) {
      function checkItem(item: any) {
        if (item.type === "image") imageIds.push(item.id);
      }
      day.items.forEach(checkItem);
    }
    manifest.photoDays.forEach(collectIds);

    // Verify analysis exists for all
    function verifyAnalysis(id: string) {
      expect(analysisManifest[id]).toBeDefined();
      expect(analysisManifest[id].phash).toBe("abc");
    }
    imageIds.forEach(verifyAnalysis);
  });
});

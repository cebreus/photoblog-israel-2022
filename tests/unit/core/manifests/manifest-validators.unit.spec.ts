import { describe, expect, it } from "vitest";
import {
  isValidAnalysisManifest,
  isValidCache,
  isValidClusteringConstraints,
  isValidCurationManifest,
  isValidEmbeddingsManifest,
  isValidFacesManifest,
  isValidImageEntry,
  isValidManifest,
  isValidMenuManifest,
  isValidPeopleManifest,
  isValidPerson,
  isValidPhotoDay,
  parseJsonOrNull,
  parseJsonSafe,
} from "$lib/utils/manifest-validators";

describe("manifest-validators", () => {
  describe("isValidPerson", () => {
    it("should validate correct person", () => {
      const person = {
        id: "p1",
        name: "Alice",
        faceDescriptor: [0.1, 0.2],
        faceCount: 5,
        thumbnail: "thumb.jpg",
        junk: false,
        hidden: false,
        createdAt: "2024-01-01",
        lastSeenAt: "2024-01-02",
      };
      expect(isValidPerson(person)).toBe(true);
    });

    it("should fail for missing fields", () => {
      expect(isValidPerson({ id: "p1" })).toBe(false);
    });
  });

  describe("isValidPhotoDay", () => {
    it("should validate correct photo day", () => {
      expect(isValidPhotoDay({ date: "2024-01-01", id: "d1", items: [] })).toBe(true);
    });
  });

  describe("isValidClusteringConstraints", () => {
    it("should validate partial or full constraints", () => {
      expect(isValidClusteringConstraints({})).toBe(true);
      expect(
        isValidClusteringConstraints({
          disconnects: [{ imageId: "i1", personId: "p1" }],
        }),
      ).toBe(true);
      expect(
        isValidClusteringConstraints({
          ignoredCrops: [{ imageId: "i1", box: { x: 0, y: 0, width: 10, height: 10 } }],
        }),
      ).toBe(true);
    });

    it("should fail for invalid entries", () => {
      expect(
        isValidClusteringConstraints({
          disconnects: [{ imageId: "i1" }], // missing personId
        }),
      ).toBe(false);
    });
  });

  describe("parseJsonSafe", () => {
    it("should return parsed data if valid", () => {
      const json = '{"date": "2024-01-01", "id": "d1", "items": []}';
      const result = parseJsonSafe(json, isValidPhotoDay, {} as any);
      expect(result.id).toBe("d1");
    });

    it("should return default if invalid", () => {
      const json = '{"date": "2024-01-01"}';
      const result = parseJsonSafe(json, isValidPhotoDay, { id: "default" } as any);
      expect(result.id).toBe("default");
    });

    it("should return default if malformed JSON", () => {
      const result = parseJsonSafe("invalid", isValidPhotoDay, { id: "default" } as any);
      expect(result.id).toBe("default");
    });
  });

  describe("isValidAnalysisManifest", () => {
    it("should validate correct analysis", () => {
      const manifest = {
        img1: { sharpness: 0.8, phash: "abc" },
      };
      expect(isValidAnalysisManifest(manifest)).toBe(true);
    });
  });

  describe("isValidFacesManifest", () => {
    it("should validate correct faces manifest", () => {
      const manifest = {
        img1: {
          facesDetected: true,
          faces: [{ x: 1, y: 1, width: 10, height: 10 }],
          peopleIds: ["p1"],
        },
      };
      expect(isValidFacesManifest(manifest)).toBe(true);
    });

    it("should fail for invalid faces manifest", () => {
      expect(isValidFacesManifest({ img1: {} })).toBe(false);
    });
  });

  describe("isValidPeopleManifest", () => {
    it("should validate correct people manifest", () => {
      expect(isValidPeopleManifest({ people: [] })).toBe(true);
    });
  });

  describe("isValidManifest", () => {
    it("should validate manifest with photoDays", () => {
      expect(isValidManifest({ photoDays: [] })).toBe(true);
      expect(isValidManifest({ photoDays: [{ date: "2024-01-01", id: "d1", items: [] }] })).toBe(
        true,
      );
    });
  });

  describe("isValidMenuManifest", () => {
    it("should validate menu manifest", () => {
      expect(isValidMenuManifest([])).toBe(true);
    });
  });

  describe("isValidCurationManifest", () => {
    it("should validate curation manifest", () => {
      const curation = {
        groups: [],
        stats: { totalPhotos: 10, totalGroups: 2 },
      };
      expect(isValidCurationManifest(curation)).toBe(true);
    });
  });

  describe("isValidCache", () => {
    it("should validate cache", () => {
      const cache = {
        version: 1,
        configHash: "abc",
        files: {},
      };
      expect(isValidCache(cache)).toBe(true);
    });
  });

  describe("isValidImageEntry", () => {
    it("should validate image entry", () => {
      const entry = {
        id: "i1",
        type: "image",
        src: "s1",
        alt: "a1",
        sources: [],
      };
      expect(isValidImageEntry(entry)).toBe(true);
    });
  });

  describe("isValidEmbeddingsManifest", () => {
    it("should validate embeddings", () => {
      expect(isValidEmbeddingsManifest({ img1: [0.1, 0.2] })).toBe(true);
      expect(isValidEmbeddingsManifest({ img1: ["not a number"] })).toBe(false);
    });
  });

  describe("parseJsonOrNull", () => {
    it("should return parsed data or null", () => {
      expect(parseJsonOrNull('{"people": []}', isValidPeopleManifest)).not.toBeNull();
      expect(parseJsonOrNull('{"invalid": true}', isValidPeopleManifest)).toBeNull();
      expect(parseJsonOrNull("invalid json", isValidPeopleManifest)).toBeNull();
    });
  });
});

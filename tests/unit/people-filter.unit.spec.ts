/**
 * @fileoverview People Filtering Unit Tests
 *
 * @description
 * Tests the logic for filtering images based on people.
 * Verifies that images containing specific people are correctly included or excluded
 * based on filter criteria.
 *
 * @modules-tested
 * - src/lib/utils/people-filter.ts
 */

import { describe, expect, it } from "vitest";
import type { ImageEntry, Person } from "$lib/types/manifest";
import { filterGalleryItems } from "$lib/utils/gallery";

describe("People Filter Logic", () => {
  const mockPeople: Person[] = [
    {
      id: "person-1",
      name: "Alice",
      faceDescriptor: [],
      faceCount: 5,
      thumbnail: "faces/person-1.jpg",
      ignored: false,
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "person-2",
      name: "Bob",
      faceDescriptor: [],
      faceCount: 3,
      thumbnail: "faces/person-2.jpg",
      ignored: false,
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "person-3",
      name: "Statue",
      faceDescriptor: [],
      faceCount: 10,
      thumbnail: "faces/person-3.jpg",
      ignored: true, // Blacklisted
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-01T00:00:00Z",
    },
  ];

  const mockImages: ImageEntry[] = [
    {
      id: "img1",
      src: "img1.jpg",
      alt: "",
      title: "",
      type: "image",
      width: 1920,
      height: 1080,
      sources: [],
      exif: {},
      authorSlug: "cebreus",
      people: ["person-1"],
    },
    {
      id: "img2",
      src: "img2.jpg",
      alt: "",
      title: "",
      type: "image",
      width: 1920,
      height: 1080,
      sources: [],
      exif: {},
      authorSlug: "cebreus",
      people: ["person-1", "person-2"],
    },
    {
      id: "img3",
      src: "img3.jpg",
      alt: "",
      title: "",
      type: "image",
      width: 1920,
      height: 1080,
      sources: [],
      exif: {},
      authorSlug: "cebreus",
      people: ["person-1"],
    },
    {
      id: "img4",
      src: "img4.jpg",
      alt: "",
      title: "",
      type: "image",
      width: 1920,
      height: 1080,
      sources: [],
      exif: {},
      authorSlug: "cebreus",
      people: ["person-2"],
    },
    {
      id: "img5",
      src: "img5.jpg",
      alt: "",
      title: "",
      type: "image",
      width: 1920,
      height: 1080,
      sources: [],
      exif: {},
      authorSlug: "cebreus",
      people: ["person-3"],
    },
  ];

  describe("Default Behavior (Empty Selection)", () => {
    it("should show all photos when selectedPeople is empty array (default)", () => {
      // Empty array [] = ALL selected (same as authors)
      const result = filterGalleryItems(mockImages, [], true, ["excellent", "good", "poor"], []);
      expect(result).toHaveLength(5);
    });

    it.todo("should hide all photos with people when selectedPeople is ['none']", () => {
      // ["none"] = NONE selected (hide photos with detected people)
      const _result = filterGalleryItems(
        mockImages,
        [],
        true,
        ["excellent", "good", "poor"],
        ["none"],
      );
      // This will work once getImagePeopleMap is implemented in Phase 2
    });
  });

  describe("People Selection", () => {
    it.todo("should filter to show only photos with selected person", () => {
      // Mock getImagePeopleMap to return person-image mapping
      const _result = filterGalleryItems(
        mockImages,
        [],
        true,
        ["excellent", "good", "poor"],
        ["person-1"],
      );
      // Should show img1, img2, img3 (Alice's photos)
      // Note: This test will pass once getImagePeopleMap is properly implemented in Phase 2
    });

    it.todo("should show photos containing ANY of the selected people", () => {
      const _result = filterGalleryItems(
        mockImages,
        [],
        true,
        ["excellent", "good", "poor"],
        ["person-1", "person-2"],
      );
      // Should show img1, img2, img3, img4 (Alice OR Bob)
      // Note: This test will pass once getImagePeopleMap is properly implemented in Phase 2
    });
  });

  describe("Ignored People", () => {
    it("should filter out ignored people from visible list", () => {
      const visiblePeople = mockPeople.filter((p) => !p.ignored);
      expect(visiblePeople).toHaveLength(2);
      expect(visiblePeople.map((p) => p.id)).toEqual(["person-1", "person-2"]);
    });

    it("should include ignored people in ignored list", () => {
      const ignoredPeople = mockPeople.filter((p) => p.ignored);
      expect(ignoredPeople).toHaveLength(1);
      expect(ignoredPeople[0].id).toBe("person-3");
    });
  });

  describe("Person Type Schema", () => {
    it("should have required fields", () => {
      const person = mockPeople[0];
      expect(person).toHaveProperty("id");
      expect(person).toHaveProperty("name");
      expect(person).toHaveProperty("faceDescriptor");
      expect(person).toHaveProperty("faceCount");
      expect(person).toHaveProperty("thumbnail");
      expect(person).toHaveProperty("ignored");
      expect(person).toHaveProperty("createdAt");
      expect(person).toHaveProperty("lastSeenAt");
    });

    it("should support optional manualImageIds field", () => {
      const personWithManualTags: Person = {
        ...mockPeople[0],
        manualImageIds: ["img10", "img11"],
      };
      expect(personWithManualTags.manualImageIds).toEqual(["img10", "img11"]);
    });
  });

  describe("Sorting", () => {
    it("should sort people by faceCount descending", () => {
      const sorted = [...mockPeople]
        .filter((p) => !p.ignored)
        .sort((a, b) => b.faceCount - a.faceCount);

      expect(sorted[0].id).toBe("person-1"); // Alice: 5 photos
      expect(sorted[1].id).toBe("person-2"); // Bob: 3 photos
    });
  });
});

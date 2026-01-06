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
import { type FilterCriteria, filterGalleryItems } from "$lib/utils/gallery";

describe("People Filter Logic", () => {
  const mockPeople: Person[] = [
    {
      id: "person-1",
      name: "Alice",
      faceDescriptor: [],
      faceCount: 5,
      thumbnail: "faces/person-1.jpg",
      hidden: false,
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-01T00:00:00Z",
      clusters: [],
    },
    {
      id: "person-2",
      name: "Bob",
      faceDescriptor: [],
      faceCount: 3,
      thumbnail: "faces/person-2.jpg",
      hidden: false,
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-01T00:00:00Z",
      clusters: [],
    },
    {
      id: "person-3",
      name: "Statue",
      faceDescriptor: [],
      faceCount: 10,
      thumbnail: "faces/person-3.jpg",
      hidden: true, // Blacklisted
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-01T00:00:00Z",
      clusters: [],
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
      exif: { date: "2025-01-01T12:00:00", releaseDate: "2025-01-01T12:00:00" },
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
      exif: { date: "2025-01-01T12:00:00", releaseDate: "2025-01-01T12:00:00" },
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
      exif: { date: "2025-01-01T12:00:00", releaseDate: "2025-01-01T12:00:00" },
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
      exif: { date: "2025-01-01T12:00:00", releaseDate: "2025-01-01T12:00:00" },
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
      exif: { date: "2025-01-01T12:00:00", releaseDate: "2025-01-01T12:00:00" },
      authorSlug: "cebreus",
      people: ["person-3"],
    },
  ];

  const defaultCriteria: FilterCriteria = {
    // Explicitly typed
    selectedAuthors: [],
    showSeparators: true,
    selectedQualityBuckets: [], // Empty to disable quality filter checks
    selectedPeople: [],
    selectedMediaTypes: [],
    showOthersSnapshots: true,
    showAuthorSnapshots: true,
    onlySnapshots: false,
  };

  // Build map from mock data for all tests
  const mockMap: Record<string, string[]> = {};
  for (const img of mockImages) {
    if (img.people) mockMap[img.id] = img.people;
  }

  describe("Default Behavior (Empty Selection)", () => {
    it("should show all photos when selectedPeople is empty array (default)", () => {
      // Empty array [] = ALL selected (same as authors)
      const result = filterGalleryItems(mockImages, defaultCriteria, mockMap);
      expect(result).toHaveLength(5);
    });

    it("should hide all photos when selectedPeople is ['none']", () => {
      // ["none"] = NONE selected (hide photos with detected people) -> Actually hides EVERYTHING
      const result = filterGalleryItems(
        mockImages,
        {
          ...defaultCriteria,
          selectedPeople: ["none"],
        },
        mockMap,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("People Selection", () => {
    it("should filter to show only photos with selected person", () => {
      const result = filterGalleryItems(
        mockImages,
        {
          ...defaultCriteria,
          selectedPeople: ["person-1"],
        },
        mockMap,
      );
      // Should show img1, img2, img3 (Alice's photos)
      expect(result.map((i) => i.id).sort()).toEqual(["img1", "img2", "img3"]);
    });

    it("should show photos containing ANY of the selected people", () => {
      const result = filterGalleryItems(
        mockImages,
        {
          ...defaultCriteria,
          selectedPeople: ["person-1", "person-2"],
        },
        mockMap,
      );
      // Should show img1, img2, img3, img4 (Alice OR Bob)
      // img1: [p1], img2: [p1, p2], img3: [p1], img4: [p2]
      expect(result.map((i) => i.id).sort()).toEqual(["img1", "img2", "img3", "img4"]);
    });
  });

  describe("Hidden People", () => {
    it("should filter out hidden people from visible list", () => {
      const visiblePeople = mockPeople.filter((p) => !p.hidden);
      expect(visiblePeople).toHaveLength(2);
      expect(visiblePeople.map((p) => p.id)).toEqual(["person-1", "person-2"]);
    });

    it("should include hidden people in hidden list", () => {
      const hiddenPeople = mockPeople.filter((p) => p.hidden);
      expect(hiddenPeople).toHaveLength(1);
      expect(hiddenPeople[0].id).toBe("person-3");
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
      expect(person).toHaveProperty("hidden");
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
        .filter((p) => !p.hidden)
        .sort((a, b) => b.faceCount - a.faceCount);

      expect(sorted[0].id).toBe("person-1"); // Alice: 5 photos
      expect(sorted[1].id).toBe("person-2"); // Bob: 3 photos
    });
  });
});

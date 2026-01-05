/**
 * @fileoverview Store Integration Tests
 *
 * Tests the integration between ManifestStore, PeopleState, and FiltersState.
 *
 * NOTE: Svelte 5 runes ($derived, $state) have limited reactivity in unit tests
 * without a proper Svelte runtime. The actual reactive chain works correctly
 * in the browser/SSR environment. These tests verify the store structure and
 * methods, not the runtime reactivity.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the images utility before importing stores
vi.mock("$lib/utils/images", () => ({
  getManifest: vi.fn(() => ({ photoDays: [] })),
  getPeopleManifest: vi.fn(() => ({ people: [] })),
  getPhotoDays: vi.fn(() => []),
}));

// Mock $app/navigation
vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn(() => Promise.resolve()),
}));

describe("Store Integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("ManifestStore core functionality", () => {
    it("should update photoDays directly", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      expect(manifest.photoDays).toEqual([]);

      manifest.update({
        photoDays: [{ date: "2024-01-01", items: [] }],
      } as any);

      expect(manifest.photoDays).toHaveLength(1);
      expect(manifest.photoDays[0].date).toBe("2024-01-01");
    });

    it("should update people directly", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      expect(manifest.people).toEqual([]);

      manifest.update({
        peopleManifest: {
          people: [{ id: "p1", name: "Alice" }],
        },
      } as any);

      expect(manifest.people).toHaveLength(1);
      expect(manifest.people[0].name).toBe("Alice");
    });
  });

  describe("PeopleState structure", () => {
    it("should have correct derived properties defined", async () => {
      const { people } = await import("$lib/stores/people.svelte");

      // These properties should exist (even if empty in tests)
      expect(people).toHaveProperty("people");
      expect(people).toHaveProperty("photoDays");
      expect(people).toHaveProperty("peopleWithStats");
      expect(people).toHaveProperty("visiblePeople");
      expect(people).toHaveProperty("hiddenPeople");
      expect(people).toHaveProperty("categoryPeople");
      expect(people).toHaveProperty("categoryStatues");
      expect(people).toHaveProperty("categoryPaintings");
      expect(people).toHaveProperty("junkPeople");
      expect(people).toHaveProperty("refresh");
    });

    it("should have refresh method that calls invalidateAll", async () => {
      const { invalidateAll } = await import("$app/navigation");
      const { people } = await import("$lib/stores/people.svelte");

      await people.refresh();

      expect(invalidateAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("FiltersState structure", () => {
    it("should have correct properties defined", async () => {
      const { filters } = await import("$lib/stores/filters.svelte");

      expect(filters).toHaveProperty("selectedAuthors");
      expect(filters).toHaveProperty("selectedPeople");
      expect(filters).toHaveProperty("showSeparators");
      expect(filters).toHaveProperty("selectedQualityBuckets");
      expect(filters).toHaveProperty("selectedMediaTypes");
      expect(filters).toHaveProperty("sourceData");
      expect(filters).toHaveProperty("filteredPhotoDays");
      expect(filters).toHaveProperty("reset");
    });

    it("should have setSourceData as no-op (deprecated)", async () => {
      const { filters } = await import("$lib/stores/filters.svelte");

      // setSourceData should exist but be a no-op
      expect(filters).toHaveProperty("setSourceData");
      expect(() => filters.setSourceData([])).not.toThrow();
    });

    it("should reset filter state correctly", async () => {
      const { filters } = await import("$lib/stores/filters.svelte");

      // Set some filters
      filters.selectedAuthors = ["Alice"];
      filters.selectedPeople = ["p1"];
      filters.onlySnapshots = true;

      // Reset
      filters.reset();

      // Verify reset
      expect(filters.selectedAuthors).toEqual([]);
      expect(filters.selectedPeople).toEqual([]);
      expect(filters.onlySnapshots).toBe(false);
    });
  });

  describe("enrichPeopleWithStats utility", () => {
    it("should correctly count faces from photoDays", async () => {
      const { enrichPeopleWithStats } = await import("$lib/utils/people");

      const people = [
        { id: "p1", name: "Alice", faceCount: 0 },
        { id: "p2", name: "Bob", faceCount: 0 },
      ];

      const photoDays = [
        {
          date: "2024-01-01",
          items: [
            { id: "img1", type: "image", people: ["p1", "p2"] },
            { id: "img2", type: "image", people: ["p1"] },
          ],
        },
      ];

      const result = enrichPeopleWithStats(people as any, photoDays as any);

      expect(result.find((p) => p.id === "p1")?.faceCount).toBe(2);
      expect(result.find((p) => p.id === "p2")?.faceCount).toBe(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle null data gracefully in manifest.update", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      expect(() => manifest.update(null as any)).not.toThrow();
      expect(() => manifest.update(undefined as any)).not.toThrow();
    });

    it("should handle empty arrays correctly", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      manifest.update({
        photoDays: [{ date: "2024-01-01", items: [] }],
        peopleManifest: { people: [{ id: "p1", name: "Alice" }] },
      } as any);

      // Clear with empty
      manifest.update({
        photoDays: [],
        peopleManifest: { people: [] },
      });

      expect(manifest.photoDays).toEqual([]);
      expect(manifest.people).toEqual([]);
    });

    it("should preserve existing data on partial update", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      // Set both
      manifest.update({
        photoDays: [{ date: "2024-01-01", items: [] }],
        peopleManifest: { people: [{ id: "p1", name: "Alice" }] },
      } as any);

      // Update only photoDays
      manifest.update({
        photoDays: [{ date: "2024-01-02", items: [] }],
      } as any);

      // People should remain
      expect(manifest.people).toHaveLength(1);
      expect(manifest.people[0].name).toBe("Alice");
      // PhotoDays should be updated
      expect(manifest.photoDays[0].date).toBe("2024-01-02");
    });
  });
});

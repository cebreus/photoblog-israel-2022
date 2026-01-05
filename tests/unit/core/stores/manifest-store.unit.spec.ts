/**
 * @fileoverview ManifestStore Unit Tests
 *
 * Tests the centralized manifest store that serves as the single source of truth
 * for photoDays and people data across the application.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the images utility before importing the store
vi.mock("$lib/utils/images", () => ({
  getManifest: vi.fn(() => ({ photoDays: [] })),
  getPeopleManifest: vi.fn(() => ({ people: [] })),
}));

describe("ManifestStore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("initialization", () => {
    it("should initialize with empty arrays when manifests are empty", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      expect(manifest.photoDays).toEqual([]);
      expect(manifest.people).toEqual([]);
    });

    it("should initialize with data from static manifests", async () => {
      const { getManifest, getPeopleManifest } = await import("$lib/utils/images");

      vi.mocked(getManifest).mockReturnValue({
        photoDays: [{ date: "2024-01-01", items: [] }],
      } as any);
      vi.mocked(getPeopleManifest).mockReturnValue({
        people: [{ id: "p1", name: "Alice" }],
      } as any);

      vi.resetModules();
      const { manifest } = await import("$lib/stores/manifest.svelte");

      expect(manifest.photoDays).toHaveLength(1);
      expect(manifest.people).toHaveLength(1);
    });
  });

  describe("update()", () => {
    it("should update photoDays when provided", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      const newPhotoDays = [
        { date: "2024-01-01", items: [{ id: "img1", type: "image" }] },
        { date: "2024-01-02", items: [] },
      ];

      manifest.update({ photoDays: newPhotoDays as any });

      expect(manifest.photoDays).toHaveLength(2);
      expect(manifest.photoDays[0].date).toBe("2024-01-01");
    });

    it("should update people when peopleManifest is provided", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      const peopleManifest = {
        people: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
        ],
      };

      manifest.update({ peopleManifest: peopleManifest as any });

      expect(manifest.people).toHaveLength(2);
      expect(manifest.people[0].name).toBe("Alice");
    });

    it("should handle partial updates (only photoDays)", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      // Set initial people
      manifest.update({ peopleManifest: { people: [{ id: "p1", name: "Initial" }] } as any });

      // Update only photoDays
      manifest.update({ photoDays: [{ date: "2024-01-01", items: [] }] as any });

      // People should remain unchanged
      expect(manifest.people).toHaveLength(1);
      expect(manifest.people[0].name).toBe("Initial");
      expect(manifest.photoDays).toHaveLength(1);
    });

    it("should handle partial updates (only peopleManifest)", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      // Set initial photoDays
      manifest.update({ photoDays: [{ date: "2024-01-01", items: [] }] as any });

      // Update only people
      manifest.update({ peopleManifest: { people: [{ id: "p1", name: "New Person" }] } as any });

      // PhotoDays should remain unchanged
      expect(manifest.photoDays).toHaveLength(1);
      expect(manifest.people).toHaveLength(1);
      expect(manifest.people[0].name).toBe("New Person");
    });

    it("should not update people if peopleManifest.people is undefined", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      // Set initial people
      manifest.update({ peopleManifest: { people: [{ id: "p1", name: "Initial" }] } as any });

      // Update with empty peopleManifest (no people property)
      manifest.update({ peopleManifest: {} as any });

      // People should remain unchanged
      expect(manifest.people).toHaveLength(1);
      expect(manifest.people[0].name).toBe("Initial");
    });

    it("should not update photoDays if undefined", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      // Set initial photoDays
      manifest.update({ photoDays: [{ date: "2024-01-01", items: [] }] as any });

      // Update with undefined photoDays
      manifest.update({});

      // PhotoDays should remain unchanged
      expect(manifest.photoDays).toHaveLength(1);
    });

    it("should handle empty arrays correctly", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      // Set initial data
      manifest.update({
        photoDays: [{ date: "2024-01-01", items: [] }] as any,
        peopleManifest: { people: [{ id: "p1", name: "Alice" }] } as any,
      });

      // Clear with empty arrays
      manifest.update({
        photoDays: [],
        peopleManifest: { people: [] },
      });

      expect(manifest.photoDays).toEqual([]);
      expect(manifest.people).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle null/undefined gracefully in update", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      // This should not throw
      expect(() => manifest.update(null as any)).not.toThrow();
      expect(() => manifest.update(undefined as any)).not.toThrow();
    });

    it("should update reference when data changes", async () => {
      const { manifest } = await import("$lib/stores/manifest.svelte");

      const photoDays1 = [{ date: "2024-01-01", items: [] }];
      const photoDays2 = [{ date: "2024-01-02", items: [] }];

      manifest.update({ photoDays: photoDays1 as any });
      const date1 = manifest.photoDays[0].date;

      manifest.update({ photoDays: photoDays2 as any });
      const date2 = manifest.photoDays[0].date;

      // Different input arrays should result in different stored data
      expect(date1).toBe("2024-01-01");
      expect(date2).toBe("2024-01-02");
    });
  });
});

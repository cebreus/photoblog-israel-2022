/**
 * @fileoverview Unit tests for people-actions utilities
 *
 * Tests pure logic and API call structure.
 * Higher-level integration tests with stores would require full mocking.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the module
vi.mock("svelte-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("$lib/stores/filters.svelte", () => ({
  filters: {
    selectedPeople: [],
  },
}));

vi.mock("$lib/stores/people.svelte", () => ({
  people: {
    visiblePeople: [
      { id: "person-1", name: "Person 1", hidden: false },
      { id: "person-2", name: "Person 2", hidden: true },
    ],
    refresh: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  bulkHidePeople,
  bulkMarkAsJunk,
  bulkRestoreFromJunk,
  bulkRestorePeople,
  bulkUpdateCategory,
  mergePeopleIntoTarget,
  mergePersonIntoTarget,
  type PersonUpdate,
  updatePeople,
  updatePeopleOrThrow,
} from "$lib/utils/people-actions";

describe("people-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("updatePeople", () => {
    it("sends PATCH request with correct payload", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

      const updates: PersonUpdate[] = [{ id: "person-1", name: "New Name" }];
      await updatePeople(updates);

      expect(mockFetch).toHaveBeenCalledWith("/api/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
    });

    it("includes multiple updates in single request", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

      const updates: PersonUpdate[] = [
        { id: "person-1", hidden: true },
        { id: "person-2", hidden: true },
      ];
      await updatePeople(updates);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.updates).toHaveLength(2);
    });
  });

  describe("updatePeopleOrThrow", () => {
    it("returns JSON on success", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: "test" }), { status: 200 }),
      );

      const result = await updatePeopleOrThrow([{ id: "person-1" }]);
      expect(result).toEqual({ success: true, data: "test" });
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );

      await expect(updatePeopleOrThrow([{ id: "person-1" }])).rejects.toThrow("Not found");
    });

    it("throws generic message when no error provided", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));

      await expect(updatePeopleOrThrow([{ id: "person-1" }])).rejects.toThrow("Update failed");
    });
  });

  describe("bulk operations", () => {
    describe("bulkHidePeople", () => {
      it("returns 0 for empty array", async () => {
        const result = await bulkHidePeople([]);
        expect(result).toBe(0);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("sends correct payload for multiple people", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        const result = await bulkHidePeople(["person-1", "person-2"]);

        expect(result).toBe(2);
        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.updates).toEqual([
          { id: "person-1", hidden: true },
          { id: "person-2", hidden: true },
        ]);
      });
    });

    describe("bulkRestorePeople", () => {
      it("returns 0 for empty array", async () => {
        const result = await bulkRestorePeople([]);
        expect(result).toBe(0);
      });

      it("sends hidden: false for all people", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        await bulkRestorePeople(["person-1"]);

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.updates[0].hidden).toBe(false);
      });
    });

    describe("bulkMarkAsJunk", () => {
      it("returns 0 for empty array", async () => {
        const result = await bulkMarkAsJunk([]);
        expect(result).toBe(0);
      });

      it("sends junk: true for all people", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        await bulkMarkAsJunk(["person-1", "person-2"]);

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.updates).toEqual([
          { id: "person-1", junk: true },
          { id: "person-2", junk: true },
        ]);
      });
    });

    describe("bulkRestoreFromJunk", () => {
      it("sends junk: false for all people", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        await bulkRestoreFromJunk(["person-1"]);

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.updates[0].junk).toBe(false);
      });
    });

    describe("bulkUpdateCategory", () => {
      it("returns 0 for empty array", async () => {
        const result = await bulkUpdateCategory([], "statue");
        expect(result).toBe(0);
      });

      it("sends correct category for all people", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        await bulkUpdateCategory(["person-1", "person-2"], "painting");

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.updates).toEqual([
          { id: "person-1", category: "painting" },
          { id: "person-2", category: "painting" },
        ]);
      });
    });
  });

  describe("merge operations", () => {
    describe("mergePeopleIntoTarget", () => {
      it("throws for empty source array", async () => {
        await expect(mergePeopleIntoTarget([], "target-1")).rejects.toThrow(
          "No source people to merge",
        );
      });

      it("sends correct POST payload", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        await mergePeopleIntoTarget(["source-1", "source-2"], "target-1");

        expect(mockFetch).toHaveBeenCalledWith("/api/people/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourcePersonIds: ["source-1", "source-2"],
            targetPersonId: "target-1",
          }),
        });
      });

      it("throws on error response", async () => {
        mockFetch.mockResolvedValue(
          new Response(JSON.stringify({ error: "Merge conflict" }), { status: 400 }),
        );

        await expect(mergePeopleIntoTarget(["source-1"], "target-1")).rejects.toThrow(
          "Merge conflict",
        );
      });
    });

    describe("mergePersonIntoTarget", () => {
      it("sends correct POST payload for single merge", async () => {
        mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));

        await mergePersonIntoTarget("source-1", "target-1");

        expect(mockFetch).toHaveBeenCalledWith("/api/people/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourcePersonId: "source-1",
            targetPersonId: "target-1",
          }),
        });
      });

      it("throws on error response", async () => {
        mockFetch.mockResolvedValue(
          new Response(JSON.stringify({ error: "Invalid target" }), { status: 404 }),
        );

        await expect(mergePersonIntoTarget("source-1", "invalid")).rejects.toThrow(
          "Invalid target",
        );
      });
    });
  });
});

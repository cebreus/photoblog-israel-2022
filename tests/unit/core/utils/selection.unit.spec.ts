/**
 * @fileoverview Unit tests for selection utilities
 */

import { describe, expect, it } from "vitest";
import {
  createIdMap,
  filterBySelection,
  findIndexById,
  getRange,
  handleShiftClickSelection,
  toggleInSet,
} from "$lib/utils/selection";

describe("selection utilities", () => {
  describe("getRange", () => {
    it("returns items between indices (ascending)", () => {
      const items = ["a", "b", "c", "d", "e"];
      expect(getRange(items, 1, 3)).toEqual(["b", "c", "d"]);
    });

    it("returns items between indices (descending)", () => {
      const items = ["a", "b", "c", "d", "e"];
      expect(getRange(items, 3, 1)).toEqual(["b", "c", "d"]);
    });

    it("handles same start and end", () => {
      const items = ["a", "b", "c"];
      expect(getRange(items, 1, 1)).toEqual(["b"]);
    });
  });

  describe("findIndexById", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    it("finds index of existing item", () => {
      expect(findIndexById(items, "b")).toBe(1);
    });

    it("returns -1 for non-existent item", () => {
      expect(findIndexById(items, "x")).toBe(-1);
    });
  });

  describe("handleShiftClickSelection", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];

    it("toggles single item when shift is not held", () => {
      const result = handleShiftClickSelection(new Set(), "b", null, items, false);
      expect(result.selection).toEqual(new Set(["b"]));
      expect(result.lastSelected).toBe("b");
    });

    it("removes item when already selected and shift is not held", () => {
      const result = handleShiftClickSelection(new Set(["b"]), "b", null, items, false);
      expect(result.selection).toEqual(new Set());
    });

    it("selects range when shift is held and anchor exists", () => {
      const result = handleShiftClickSelection(new Set(["a"]), "d", "a", items, true);
      expect(result.selection).toEqual(new Set(["a", "b", "c", "d"]));
      expect(result.lastSelected).toBe("a"); // Anchor preserved
    });

    it("selects range in reverse order", () => {
      const result = handleShiftClickSelection(new Set(["d"]), "b", "d", items, true);
      expect(result.selection).toEqual(new Set(["b", "c", "d"]));
    });

    it("falls back to toggle when anchor not found", () => {
      const result = handleShiftClickSelection(new Set(), "c", "nonexistent", items, true);
      expect(result.selection).toEqual(new Set(["c"]));
    });
  });

  describe("filterBySelection", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    it("filters items by selection", () => {
      const selection = new Set(["a", "c"]);
      expect(filterBySelection(items, selection)).toEqual([{ id: "a" }, { id: "c" }]);
    });

    it("returns empty array for empty selection", () => {
      expect(filterBySelection(items, new Set())).toEqual([]);
    });
  });

  describe("createIdMap", () => {
    it("creates a map keyed by ID", () => {
      const items = [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ];
      const map = createIdMap(items);
      expect(map.get("a")).toEqual({ id: "a", name: "Alpha" });
      expect(map.get("b")).toEqual({ id: "b", name: "Beta" });
      expect(map.get("c")).toBeUndefined();
    });
  });

  describe("toggleInSet", () => {
    it("adds item if not present", () => {
      const set = new Set(["a"]);
      expect(toggleInSet(set, "b")).toEqual(new Set(["a", "b"]));
    });

    it("removes item if present", () => {
      const set = new Set(["a", "b"]);
      expect(toggleInSet(set, "b")).toEqual(new Set(["a"]));
    });

    it("does not mutate original set", () => {
      const original = new Set(["a"]);
      const result = toggleInSet(original, "b");
      expect(original).toEqual(new Set(["a"]));
      expect(result).toEqual(new Set(["a", "b"]));
    });
  });
});

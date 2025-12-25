/**
 * @fileoverview URL Synchronization Unit Tests (Read/Features)
 *
 * @description
 * Tests the advanced features of URL synchronization (reading state).
 * Verifies correct parsing of URL parameters back into internal state,
 * handling of arrays, booleans, and legacy formats.
 *
 * @modules-tested
 * - src/lib/stores/urlSync.svelte.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules BEFORE importing the file under test
vi.mock("$app/environment", () => ({
  browser: true,
  dev: true,
}));

// Mock rune-based stores
vi.mock("$lib/stores/filters.svelte", () => {
  return {
    filters: {
      filtersSyncing: false,
      selectedAuthors: [],
      showSeparators: true,
      selectedQualityBuckets: ["excellent", "good", "poor"],
      selectedPeople: [],
    },
  };
});

vi.mock("$lib/stores/ui.svelte", () => {
  return {
    ui: {
      photoLabels: false,
      sidebarOpen: false,
      debugMode: false,
      activeTab: "agenda",
      curationMode: false,
    },
  };
});

vi.mock("$lib/stores/editor.svelte", () => {
  return {
    editor: {
      selection: new Set(),
      editMode: false,
      showMetadataOverlay: false,
    },
  };
});

// Import mocked stores
import { editor } from "$lib/stores/editor.svelte";
import { filters } from "$lib/stores/filters.svelte";
import { ui } from "$lib/stores/ui.svelte";
import { initializeFiltersFromUrl } from "$lib/stores/urlSync.svelte";
import { parseBooleanParam } from "$lib/utils/url-params";

describe("URL Helpers", () => {
  describe("parseBooleanParam", () => {
    it("handles true/false case insensitive and trimmed", () => {
      expect(parseBooleanParam("true")).toBe(true);
      expect(parseBooleanParam("True")).toBe(true);
      expect(parseBooleanParam("  TRUE  ")).toBe(true);
      expect(parseBooleanParam("false")).toBe(false);
      expect(parseBooleanParam("False")).toBe(false);
    });

    it("returns undefined for invalid or empty", () => {
      expect(parseBooleanParam("")).toBe(undefined);
      expect(parseBooleanParam(null)).toBe(undefined);
      expect(parseBooleanParam("yes")).toBe(undefined);
      expect(parseBooleanParam("0")).toBe(undefined);
      expect(parseBooleanParam("1")).toBe(undefined);
    });
  });
});

describe("initializeFiltersFromUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset states
    filters.selectedAuthors = [];
    filters.selectedQualityBuckets = ["excellent", "good", "poor"];
    filters.selectedPeople = [];
    filters.showSeparators = true;

    ui.photoLabels = false;
    ui.sidebarOpen = false;
    ui.debugMode = false;
    ui.activeTab = "agenda";
    ui.curationMode = false;

    editor.selection = new Set();
    editor.editMode = false;
    editor.showMetadataOverlay = false;
  });

  describe("Overlay", () => {
    it("sets true when param present (no value)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?overlay"));
      expect(editor.showMetadataOverlay).toBe(true);
    });

    it("sets true when 'true'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?overlay=true"));
      expect(editor.showMetadataOverlay).toBe(true);
    });

    it("sets false when 'false'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?overlay=false"));
      expect(editor.showMetadataOverlay).toBe(false);
    });

    it("ignores when missing", () => {
      // Set specific value first to see if it changes
      editor.showMetadataOverlay = true;
      initializeFiltersFromUrl(new URL("https://example.com/"));
      expect(editor.showMetadataOverlay).toBe(true);
    });
  });

  describe("Sidebar", () => {
    it("sets open when 'sidebar' present", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?sidebar"));
      expect(ui.sidebarOpen).toBe(true);
    });

    it("sets closed when 'sidebar=false'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?sidebar=false"));
      expect(ui.sidebarOpen).toBe(false);
    });

    it("defaults to open if missing", () => {
      ui.sidebarOpen = false;
      initializeFiltersFromUrl(new URL("https://example.com/"));
      expect(ui.sidebarOpen).toBe(true);
    });
  });

  describe("Lists (Authors, People, Quality)", () => {
    it("parses authors CSV", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=jan,petr"));
      expect(filters.selectedAuthors).toEqual(["jan", "petr"]);
    });

    it("parses quality CSV", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?quality=great,good"));
      expect(filters.selectedQualityBuckets).toEqual(["great", "good"]);
    });

    it("parses people CSV", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?people=p1,p2"));
      expect(filters.selectedPeople).toEqual(["p1", "p2"]);
    });
  });

  describe("Flags & Booleans", () => {
    it("enables curation mode", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?curation"));
      expect(ui.curationMode).toBe(true);
    });

    it("sets active tab", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?tab=map"));
      expect(ui.activeTab).toBe("map");
    });

    it("handles separators logic (no-separators)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?no-separators"));
      expect(filters.showSeparators).toBe(false);
    });

    it("handles labels", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?labels"));
      expect(ui.photoLabels).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty CSV values gracefully", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=,,jan,,"));
      expect(filters.selectedAuthors).toEqual(["jan"]);
    });

    it("handles URL-encoded special characters in authors", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=jan%20nov%C3%A1k"));
      expect(filters.selectedAuthors).toEqual(["jan-novak"]);
    });

    it("handles 'unknown' author token", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=unknown,jan"));
      expect(filters.selectedAuthors).toEqual(["unknown", "jan"]);
    });

    it("handles legacy 'author' param (singular)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?author=jan&author=petr"));
      expect(filters.selectedAuthors).toEqual(["jan", "petr"]);
    });

    it("handles empty quality param as 'none selected'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?quality="));
      expect(filters.selectedQualityBuckets).toEqual([]);
    });

    it("defaults to all quality buckets when param missing", () => {
      initializeFiltersFromUrl(new URL("https://example.com/"));
      expect(filters.selectedQualityBuckets).toEqual(["excellent", "good", "poor"]);
    });

    it("handles mixed presence-only and valued params", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?sidebar&tab=map&labels"));
      expect(ui.sidebarOpen).toBe(true);
      expect(ui.activeTab).toBe("map");
      expect(ui.photoLabels).toBe(true);
    });

    it("handles conflicting separator params (no-separators takes precedence)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?separators=true&no-separators"));
      expect(filters.showSeparators).toBe(false);
    });
  });
});

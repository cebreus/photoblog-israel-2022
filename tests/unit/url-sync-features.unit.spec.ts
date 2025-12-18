import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules BEFORE importing the file under test
vi.mock("$app/environment", () => ({
  browser: true,
}));

// Mock the stores module completely
vi.mock("$lib/stores/editorState", () => {
  const showMetadataOverlay = {
    set: vi.fn(),
    subscribe: vi.fn((fn) => {
      fn(false);
      return () => {};
    }),
    update: vi.fn(),
  };

  const selection = {
    set: vi.fn(),
    subscribe: vi.fn(),
  };

  const editMode = {
    set: vi.fn(),
    subscribe: vi.fn(),
  };

  return {
    showMetadataOverlay,
    selection,
    editMode,
  };
});

// Mock other dependencies to avoid errors
vi.mock("$lib/stores/filters", () => ({
  filtersSyncing: { set: vi.fn() },
  selectedAuthors: { set: vi.fn(), subscribe: vi.fn() },
  showSeparators: { set: vi.fn(), subscribe: vi.fn() },
  selectedQualityBuckets: { set: vi.fn(), subscribe: vi.fn() },
  selectedPeople: { set: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("$lib/stores/photoLabels", () => ({
  showPhotoLabels: { set: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("$lib/stores/debug", () => ({
  debug: { set: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("$lib/stores/uiState", () => ({
  activeTab: { set: vi.fn(), subscribe: vi.fn() },
  isSidebarOpen: { set: vi.fn(), subscribe: vi.fn() },
  isCurationMode: { set: vi.fn(), subscribe: vi.fn() },
}));

// Import code under test
// Import code under test
import { initializeFiltersFromUrl, parseBooleanParam } from "../../src/lib/stores/urlSync";
// Import mocked stores
import { showMetadataOverlay } from "$lib/stores/editorState";
import {
    selectedAuthors,
    selectedPeople,
    selectedQualityBuckets,
    showSeparators,
} from "$lib/stores/filters";
import { showPhotoLabels } from "$lib/stores/photoLabels";
import { activeTab, isCurationMode, isSidebarOpen } from "$lib/stores/uiState";

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
  });

  describe("Overlay", () => {
    it("sets true when param present (no value)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?overlay"));
      expect(showMetadataOverlay.set).toHaveBeenCalledWith(true);
    });

    it("sets true when 'true'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?overlay=true"));
      expect(showMetadataOverlay.set).toHaveBeenCalledWith(true);
    });

    it("sets false when 'false'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?overlay=false"));
      expect(showMetadataOverlay.set).toHaveBeenCalledWith(false);
    });

    it("ignores when missing", () => {
      initializeFiltersFromUrl(new URL("https://example.com/"));
      expect(showMetadataOverlay.set).not.toHaveBeenCalled();
    });
  });

  describe("Sidebar", () => {
    it("sets open when 'sidebar' present", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?sidebar"));
      expect(isSidebarOpen.set).toHaveBeenCalledWith(true);
    });

    it("sets closed when 'sidebar=false'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?sidebar=false"));
      expect(isSidebarOpen.set).toHaveBeenCalledWith(false);
    });

    it("defaults to closed if missing (explicit check logic)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/"));
      expect(isSidebarOpen.set).toHaveBeenCalledWith(false);
    });
  });

  describe("Lists (Authors, People, Quality)", () => {
    it("parses authors CSV", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=jan,petr"));
      // Note: Logic inside uses toSlug if authors list is empty/mocked
      expect(selectedAuthors.set).toHaveBeenCalledWith(["jan", "petr"]);
    });

    it("parses quality CSV", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?quality=great,good"));
      expect(selectedQualityBuckets.set).toHaveBeenCalledWith(["great", "good"]);
    });

    it("parses people CSV", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?people=p1,p2"));
      expect(selectedPeople.set).toHaveBeenCalledWith(["p1", "p2"]);
    });
  });

  describe("Flags & Booleans", () => {
    it("enables curation mode", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?curation"));
      expect(isCurationMode.set).toHaveBeenCalledWith(true);
    });

    it("sets active tab", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?tab=map"));
      expect(activeTab.set).toHaveBeenCalledWith("map");
    });

    it("handles separators logic (no-separators)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?no-separators"));
      expect(showSeparators.set).toHaveBeenCalledWith(false);
    });

    it("handles labels", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?labels"));
      expect(showPhotoLabels.set).toHaveBeenCalledWith(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty CSV values gracefully", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=,,jan,,"));
      // Empty tokens should be filtered out by filter(Boolean)
      expect(selectedAuthors.set).toHaveBeenCalledWith(["jan"]);
    });

    it("handles URL-encoded special characters in authors", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=jan%20nov%C3%A1k"));
      expect(selectedAuthors.set).toHaveBeenCalledWith(["jan-novak"]);
    });

    it("handles 'unknown' author token", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?authors=unknown,jan"));
      // When authors array is empty (in mocks), "unknown" is treated as regular slug
      expect(selectedAuthors.set).toHaveBeenCalledWith(["unknown", "jan"]);
    });

    it("handles legacy 'author' param (singular)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?author=jan&author=petr"));
      expect(selectedAuthors.set).toHaveBeenCalledWith(["jan", "petr"]);
    });

    it("handles empty quality param as 'none selected'", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?quality="));
      expect(selectedQualityBuckets.set).toHaveBeenCalledWith([]);
    });

    it("defaults to all quality buckets when param missing", () => {
      initializeFiltersFromUrl(new URL("https://example.com/"));
      expect(selectedQualityBuckets.set).toHaveBeenCalledWith(["excellent", "good", "poor"]);
    });

    it("handles mixed presence-only and valued params", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?sidebar&tab=map&labels"));
      expect(isSidebarOpen.set).toHaveBeenCalledWith(true);
      expect(activeTab.set).toHaveBeenCalledWith("map");
      expect(showPhotoLabels.set).toHaveBeenCalledWith(true);
    });

    it("handles conflicting separator params (no-separators takes precedence)", () => {
      initializeFiltersFromUrl(new URL("https://example.com/?separators=true&no-separators"));
      expect(showSeparators.set).toHaveBeenCalledWith(false);
    });
  });
});

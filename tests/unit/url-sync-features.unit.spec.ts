import { describe, it, expect, vi, beforeEach } from "vitest";

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
}));

// Import code under test
import { initializeFiltersFromUrl } from "../../src/lib/stores/urlSync";
// Import the mocked store to assert on it
import { showMetadataOverlay } from "$lib/stores/editorState";

describe("initializeFiltersFromUrl - overlay feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets showMetadataOverlay to true when overlay param is present (no value)", () => {
    const url = new URL("https://example.com/?overlay");
    initializeFiltersFromUrl(url);
    expect(showMetadataOverlay.set).toHaveBeenCalledWith(true);
  });

  it("sets showMetadataOverlay to true when overlay is 'true'", () => {
    const url = new URL("https://example.com/?overlay=true");
    initializeFiltersFromUrl(url);
    expect(showMetadataOverlay.set).toHaveBeenCalledWith(true);
  });

  it("sets showMetadataOverlay to false when overlay is 'false'", () => {
    const url = new URL("https://example.com/?overlay=false");
    initializeFiltersFromUrl(url);
    expect(showMetadataOverlay.set).toHaveBeenCalledWith(false);
  });

  it("does not set showMetadataOverlay when overlay param is missing", () => {
    const url = new URL("https://example.com/");
    initializeFiltersFromUrl(url);
    expect(showMetadataOverlay.set).not.toHaveBeenCalled();
  });
});

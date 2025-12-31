/**
 * @fileoverview URL Synchronization Unit Tests (Write Direction)
 *
 * @description
 * Tests the logic that synchronizes internal Store state to the URL query parameters.
 * Verifies debouncing, parameter serialization, default value omission,
 * and correct usage of SvelteKit's `goto` navigation.
 *
 * @modules-tested
 * - src/lib/stores/urlSync.svelte.ts
 */
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

// Mock modules BEFORE importing the file under test
vi.mock("$app/environment", () => ({
  browser: true,
}));

// Mock goto from $app/navigation
vi.mock("$app/navigation", () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

// Mock $app/state (Svelte 5)
let mockPageState = {
  url: new URL("https://example.com/"),
  params: {},
  route: { id: "/" },
  status: 200,
  error: null,
  data: {},
  form: null,
};

vi.mock("$app/state", () => ({
  get page() {
    return mockPageState;
  },
}));

// Mock rune-based stores
vi.mock("$lib/stores/filters.svelte", () => {
  return {
    filters: {
      filtersSyncing: false,
      selectedAuthors: [],
      showSeparators: true,
      selectedQualityBuckets: [],
      selectedPeople: [],
      selectedMediaTypes: [],
      showOthersSnapshots: true,
      showAuthorSnapshots: true,
    },
    MEDIA_TYPES: [
      { id: "image", label: "Fotografie" },
      { id: "panorama", label: "Panoramata" },
      { id: "sequence", label: "Sekvence" },
    ],
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

// Import code under test AFTER mocks
import { goto } from "$app/navigation";
import { editor } from "$lib/stores/editor.svelte";
import { filters } from "$lib/stores/filters.svelte";
import { ui } from "$lib/stores/ui.svelte";
import { syncUrlFromFilters } from "$lib/stores/urlSync.svelte";

describe("syncUrlFromFilters", () => {
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Silence console log during these tests
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Reset all states to default state
    filters.selectedAuthors = [];
    filters.selectedQualityBuckets = [];
    filters.selectedPeople = [];
    filters.selectedMediaTypes = [];
    filters.showOthersSnapshots = true;
    filters.showAuthorSnapshots = true;
    filters.showSeparators = true;
    filters.filtersSyncing = false;

    ui.photoLabels = false;
    ui.sidebarOpen = false;
    ui.debugMode = false;
    ui.activeTab = "agenda";
    ui.curationMode = false;

    editor.selection = new Set();
    editor.editMode = false;
    editor.showMetadataOverlay = false;

    // Reset page state
    mockPageState = {
      url: new URL("https://example.com/"),
      params: {},
      route: { id: "/" },
      status: 200,
      error: null,
      data: {},
      form: null,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleLogSpy.mockRestore();
  });

  it("debounces URL updates (50ms)", async () => {
    filters.selectedAuthors = ["jan"];

    syncUrlFromFilters();
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(49);
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(goto).toHaveBeenCalledTimes(1);
  });

  it("builds URL with authors param", async () => {
    filters.selectedAuthors = ["jan", "petr"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    expect(goto).toHaveBeenCalledWith(
      expect.stringContaining("authors=jan%2Cpetr"),
      expect.any(Object),
    );
  });

  it("builds URL with quality param (non-default)", async () => {
    filters.selectedQualityBuckets = ["excellent"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    expect(goto).toHaveBeenCalledWith(
      expect.stringContaining("quality=excellent"),
      expect.any(Object),
    );
  });

  it("omits quality param when no buckets selected (default)", async () => {
    filters.selectedQualityBuckets = [];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    // When no buckets are selected (default/all), URL should be unchanged, so no navigation
    expect(goto).not.toHaveBeenCalled();
  });

  it("builds presence-only params without values", async () => {
    ui.photoLabels = true;
    ui.sidebarOpen = true;

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    const url = vi.mocked(goto).mock.calls[0]?.[0] as string;
    expect(url).toMatch(/[?&]labels($|&)/);
    expect(url).toMatch(/[?&]sidebar($|&)/);
    expect(url).not.toContain("labels=");
    expect(url).not.toContain("sidebar=");
  });

  it("uses inverted flag for separators (no-separators)", async () => {
    filters.showSeparators = false;

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    const url = vi.mocked(goto).mock.calls[0]?.[0] as string;
    expect(url).toMatch(/[?&]no-separators($|&)/);
  });

  it("skips navigation if URL unchanged", async () => {
    // No filters changed, URL should stay the same
    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    expect(goto).not.toHaveBeenCalled();
  });

  it("sets filtersSyncing during operation", async () => {
    filters.selectedAuthors = ["test"];

    syncUrlFromFilters();
    expect(filters.filtersSyncing).toBe(true);

    await vi.advanceTimersByTimeAsync(50);
    // Still syncing due to added safety buffer
    expect(filters.filtersSyncing).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(filters.filtersSyncing).toBe(false);
  });

  it("handles multiple rapid calls (debounce reset)", async () => {
    filters.selectedAuthors = ["jan"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(20);

    filters.selectedAuthors = ["petr"];
    syncUrlFromFilters(); // Should reset timer

    await vi.advanceTimersByTimeAsync(49);
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith(expect.stringContaining("petr"), expect.any(Object));
  });

  it("uses replaceState navigation option", async () => {
    filters.selectedAuthors = ["test"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    expect(goto).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      }),
    );
  });

  it("handles selection set with multiple IDs", async () => {
    editor.selection = new Set(["img1", "img2", "img3"]);

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);

    const url = vi.mocked(goto).mock.calls[0]?.[0] as string;
    expect(url).toContain("edit=");
    expect(url).toMatch(/img1.*img2.*img3|img3.*img2.*img1/); // Order may vary
  });

  it("handles snapshot filters", async () => {
    filters.showAuthorSnapshots = false;
    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);
    expect(vi.mocked(goto)).toHaveBeenCalledWith(
      expect.stringContaining("no-author-snapshots"),
      expect.any(Object),
    );

    filters.showOthersSnapshots = false;
    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(50);
    expect(vi.mocked(goto)).toHaveBeenCalledWith(
      expect.stringContaining("no-others-snapshots"),
      expect.any(Object),
    );
  });
});

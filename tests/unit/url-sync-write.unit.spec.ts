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
import { type Writable, writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

// Mock modules BEFORE importing the file under test
vi.mock("$app/environment", () => ({
  browser: true,
}));

// Mock goto from $app/navigation
vi.mock("$app/navigation", () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

// Mock page store with a realistic structure
interface MockPageStore extends Writable<any> {
  set: (val: any) => void;
}

vi.mock("$app/stores", () => {
  const mockPageStore = writable({
    url: new URL("https://example.com/"),
    params: {},
    route: { id: "/" },
    status: 200,
    error: null,
    data: {},
    form: null,
  }) as MockPageStore;

  return {
    page: {
      subscribe: (fn: any) => mockPageStore.subscribe(fn),
    },
    // Export for test access
    __mockPageStore: mockPageStore,
  };
});

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
      debug: false,
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
import * as appStores from "$app/stores";
import { editor } from "$lib/stores/editor.svelte";
import { filters } from "$lib/stores/filters.svelte";
import { ui } from "$lib/stores/ui.svelte";
import { syncUrlFromFilters } from "../../src/lib/stores/urlSync.svelte";

describe("syncUrlFromFilters", () => {
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Silence console log during these tests
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Reset all states to default state
    filters.selectedAuthors = [];
    filters.selectedQualityBuckets = ["excellent", "good", "poor"];
    filters.selectedPeople = [];
    filters.showSeparators = true;
    filters.filtersSyncing = false;

    ui.photoLabels = false;
    ui.sidebarOpen = false;
    ui.debug = false;
    ui.activeTab = "agenda";
    ui.curationMode = false;

    editor.selection = new Set();
    editor.editMode = false;
    editor.showMetadataOverlay = false;

    // Reset page URL
    // biome-ignore lint/suspicious/noExplicitAny: access to mock internal
    const pageStore = (appStores as any).__mockPageStore as MockPageStore;
    pageStore.set({
      url: new URL("https://example.com/"),
      params: {},
      route: { id: "/" },
      status: 200,
      error: null,
      data: {},
      form: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleLogSpy.mockRestore();
  });

  it("debounces URL updates (300ms)", async () => {
    filters.selectedAuthors = ["jan"];

    syncUrlFromFilters();
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(299);
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(goto).toHaveBeenCalledTimes(1);
  });

  it("builds URL with authors param", async () => {
    filters.selectedAuthors = ["jan", "petr"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    expect(goto).toHaveBeenCalledWith(
      expect.stringContaining("authors=jan%2Cpetr"),
      expect.any(Object),
    );
  });

  it("builds URL with quality param (non-default)", async () => {
    filters.selectedQualityBuckets = ["excellent"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    expect(goto).toHaveBeenCalledWith(
      expect.stringContaining("quality=excellent"),
      expect.any(Object),
    );
  });

  it("omits quality param when all buckets selected (default)", async () => {
    filters.selectedQualityBuckets = ["excellent", "good", "poor"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    // When all buckets are selected (default), URL should be unchanged, so no navigation
    expect(goto).not.toHaveBeenCalled();
  });

  it("builds presence-only params without values", async () => {
    ui.photoLabels = true;
    ui.sidebarOpen = true;

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    const url = vi.mocked(goto).mock.calls[0]?.[0] as string;
    expect(url).toMatch(/[?&]labels($|&)/);
    expect(url).toMatch(/[?&]sidebar($|&)/);
    expect(url).not.toContain("labels=");
    expect(url).not.toContain("sidebar=");
  });

  it("uses inverted flag for separators (no-separators)", async () => {
    filters.showSeparators = false;

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    const url = vi.mocked(goto).mock.calls[0]?.[0] as string;
    expect(url).toMatch(/[?&]no-separators($|&)/);
  });

  it("skips navigation if URL unchanged", async () => {
    // No filters changed, URL should stay the same
    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    expect(goto).not.toHaveBeenCalled();
  });

  it("sets filtersSyncing during operation", async () => {
    filters.selectedAuthors = ["test"];

    syncUrlFromFilters();
    expect(filters.filtersSyncing).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    expect(filters.filtersSyncing).toBe(false);
  });

  it("handles multiple rapid calls (debounce reset)", async () => {
    filters.selectedAuthors = ["jan"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(100);

    filters.selectedAuthors = ["petr"];
    syncUrlFromFilters(); // Should reset timer

    await vi.advanceTimersByTimeAsync(299);
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith(expect.stringContaining("petr"), expect.any(Object));
  });

  it("uses replaceState navigation option", async () => {
    filters.selectedAuthors = ["test"];

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

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
    await vi.advanceTimersByTimeAsync(300);

    const url = vi.mocked(goto).mock.calls[0]?.[0] as string;
    expect(url).toContain("edit=");
    expect(url).toMatch(/img1.*img2.*img3|img3.*img2.*img1/); // Order may vary
  });
});

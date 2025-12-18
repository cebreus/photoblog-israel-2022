import { writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules BEFORE importing the file under test
vi.mock("$app/environment", () => ({
  browser: true,
}));

// Mock goto from $app/navigation
vi.mock("$app/navigation", () => ({
  goto: vi.fn().mockResolvedValue(undefined),
}));

// Mock page store with a realistic structure
vi.mock("$app/stores", () => {
  const mockPageStore = writable({
    url: new URL("https://example.com/"),
    params: {},
    route: { id: "/" },
    status: 200,
    error: null,
    data: {},
    form: null,
  });

  return {
    page: {
      subscribe: (fn: any) => mockPageStore.subscribe(fn),
    },
    // Export for test access
    __mockPageStore: mockPageStore,
  };
});

// Mock filter stores
vi.mock("$lib/stores/filters", () => {
  const createMockStore = (initialValue: any) => {
    const store = writable(initialValue);
    return {
      set: vi.fn((val) => store.set(val)),
      subscribe: (fn: any) => store.subscribe(fn),
      update: vi.fn((fn: any) => store.update(fn)),
    };
  };

  return {
    filtersSyncing: createMockStore(false),
    selectedAuthors: createMockStore([]),
    showSeparators: createMockStore(true),
    selectedQualityBuckets: createMockStore(["excellent", "good", "poor"]),
    selectedPeople: createMockStore([]),
  };
});

// Mock other stores
vi.mock("$lib/stores/photoLabels", () => {
  const createMockStore = (initialValue: any) => {
    const store = writable(initialValue);
    return {
      set: vi.fn((val) => store.set(val)),
      subscribe: (fn: any) => store.subscribe(fn),
    };
  };

  return {
    showPhotoLabels: createMockStore(false),
  };
});

vi.mock("$lib/stores/editorState", () => {
  const createMockStore = (initialValue: any) => {
    const store = writable(initialValue);
    return {
      set: vi.fn((val) => store.set(val)),
      subscribe: (fn: any) => store.subscribe(fn),
    };
  };

  return {
    selection: createMockStore(new Set()),
    editMode: createMockStore(false),
    showMetadataOverlay: createMockStore(false),
  };
});

vi.mock("$lib/stores/debug", () => {
  const createMockStore = (initialValue: any) => {
    const store = writable(initialValue);
    return {
      set: vi.fn((val) => store.set(val)),
      subscribe: (fn: any) => store.subscribe(fn),
    };
  };

  return {
    debug: createMockStore(false),
  };
});

vi.mock("$lib/stores/uiState", () => {
  const createMockStore = (initialValue: any) => {
    const store = writable(initialValue);
    return {
      set: vi.fn((val) => store.set(val)),
      subscribe: (fn: any) => store.subscribe(fn),
    };
  };

  return {
    activeTab: createMockStore("agenda"),
    isSidebarOpen: createMockStore(false),
    isCurationMode: createMockStore(false),
  };
});

// Import code under test AFTER mocks
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { selection } from "$lib/stores/editorState";
import {
  filtersSyncing,
  selectedAuthors,
  selectedPeople,
  selectedQualityBuckets,
  showSeparators,
} from "$lib/stores/filters";
import { showPhotoLabels } from "$lib/stores/photoLabels";
import { isSidebarOpen } from "$lib/stores/uiState";
import { syncUrlFromFilters } from "../../src/lib/stores/urlSync";

describe("syncUrlFromFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset all stores to default state
    (selectedAuthors as any).set([]);
    (selectedQualityBuckets as any).set(["excellent", "good", "poor"]);
    (selectedPeople as any).set([]);
    (showSeparators as any).set(true);
    (showPhotoLabels as any).set(false);
    (isSidebarOpen as any).set(false);

    // Reset page URL
    const pageStore = (page as any).__mockPageStore || page;
    if (pageStore.set) {
      pageStore.set({
        url: new URL("https://example.com/"),
        params: {},
        route: { id: "/" },
        status: 200,
        error: null,
        data: {},
        form: null,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces URL updates (300ms)", async () => {
    (selectedAuthors as any).set(["jan"]);

    syncUrlFromFilters();
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(299);
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(goto).toHaveBeenCalledTimes(1);
  });

  it("builds URL with authors param", async () => {
    (selectedAuthors as any).set(["jan", "petr"]);

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    expect(goto).toHaveBeenCalledWith(
      expect.stringContaining("authors=jan%2Cpetr"),
      expect.any(Object),
    );
  });

  it("builds URL with quality param (non-default)", async () => {
    (selectedQualityBuckets as any).set(["great"]);

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    expect(goto).toHaveBeenCalledWith(expect.stringContaining("quality=great"), expect.any(Object));
  });

  it("omits quality param when all buckets selected (default)", async () => {
    (selectedQualityBuckets as any).set(["excellent", "good", "poor"]);

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    // When all buckets are selected (default), URL should be unchanged, so no navigation
    expect(goto).not.toHaveBeenCalled();
  });

  it("builds presence-only params without values", async () => {
    (showPhotoLabels as any).set(true);
    (isSidebarOpen as any).set(true);

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    const url = (goto as any).mock.calls[0]?.[0];
    expect(url).toMatch(/[?&]labels($|&)/);
    expect(url).toMatch(/[?&]sidebar($|&)/);
    expect(url).not.toContain("labels=");
    expect(url).not.toContain("sidebar=");
  });

  it("uses inverted flag for separators (no-separators)", async () => {
    (showSeparators as any).set(false);

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    const url = (goto as any).mock.calls[0]?.[0];
    expect(url).toMatch(/[?&]no-separators($|&)/);
  });

  it("skips navigation if URL unchanged", async () => {
    // No filters changed, URL should stay the same
    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    expect(goto).not.toHaveBeenCalled();
  });

  it("sets filtersSyncing during operation", async () => {
    (selectedAuthors as any).set(["test"]);

    syncUrlFromFilters();
    expect((filtersSyncing as any).set).toHaveBeenCalledWith(true);

    await vi.advanceTimersByTimeAsync(300);
    expect((filtersSyncing as any).set).toHaveBeenCalledWith(false);
  });

  it("handles multiple rapid calls (debounce reset)", async () => {
    (selectedAuthors as any).set(["jan"]);

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(100);

    (selectedAuthors as any).set(["petr"]);
    syncUrlFromFilters(); // Should reset timer

    await vi.advanceTimersByTimeAsync(299);
    expect(goto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith(expect.stringContaining("petr"), expect.any(Object));
  });

  it("uses replaceState navigation option", async () => {
    (selectedAuthors as any).set(["test"]);

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
    (selection as any).set(new Set(["img1", "img2", "img3"]));

    syncUrlFromFilters();
    await vi.advanceTimersByTimeAsync(300);

    const url = (goto as any).mock.calls[0]?.[0];
    expect(url).toContain("edit=");
    expect(url).toMatch(/img1.*img2.*img3|img3.*img2.*img1/); // Order may vary
  });
});

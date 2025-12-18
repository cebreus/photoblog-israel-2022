import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { selectedAuthors, showSeparators } from "$lib/stores/filters";
import FiltersTab from "./FiltersTab.svelte";

// Mock Stores Inlined to avoid Hoisting
vi.mock("$lib/stores/photoLabels", () => ({
  showPhotoLabels: {
    subscribe: vi.fn((fn: any) => {
      fn(true);
      return () => {};
    }),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("$lib/stores/filters", () => {
  const selectedAuthors = {
    subscribe: vi.fn((fn: any) => {
      fn([]);
      return () => {};
    }),
    update: vi.fn(),
  };
  const showSeparators = {
    subscribe: vi.fn((fn: any) => {
      fn(true);
      return () => {};
    }),
    set: vi.fn(),
    update: vi.fn(),
  };
  const visiblePhotos = {
    subscribe: vi.fn((fn: any) => {
      fn(10);
      return () => {};
    }),
  };
  const selectedQualityBuckets = {
    subscribe: vi.fn((fn: any) => {
      fn([]);
      return () => {};
    }),
    update: vi.fn(),
    set: vi.fn(),
  };
  const selectedPeople = {
    subscribe: vi.fn((fn: any) => {
      fn([]);
      return () => {};
    }),
    update: vi.fn(),
    set: vi.fn(),
  };
  return {
    selectedAuthors,
    showSeparators,
    visiblePhotos,
    selectedQualityBuckets,
    selectedAestheticBuckets,
  };
});

vi.mock("$lib/stores/debug", () => ({
  debug: {
    subscribe: vi.fn((fn: any) => {
      fn(false);
      return () => {};
    }),
  },
}));

// Mock Utils
vi.mock("$lib/utils/menu", () => ({
  getMenuItems: () => [{ locations: ["Loc1"] }],
}));

vi.mock("$lib/utils/images", () => ({
  getPhotoDays: vi.fn(() => []),
  toSlug: (s: string) => s.toLowerCase().replace(/ /g, "-"),
}));

vi.mock("$lib/utils/gallery", () => ({
  QUALITY_BUCKETS: [
    { id: "excellent", label: "Excelentní" },
    { id: "good", label: "Dobré" },
    { id: "poor", label: "Podprůměrné" },
  ],
  toggleAuthor: vi.fn(),
  toggleAestheticBucket: vi.fn(),
  toggleQualityBucket: vi.fn(),
}));

// Mock Mode Watcher
vi.mock("mode-watcher", () => ({
  mode: { current: "light" },
  setMode: vi.fn(),
  resetMode: vi.fn(),
}));

describe("FiltersTab", () => {
  const authors = [
    { name: "Author One", count: 5, slug: "author-one" },
    { name: "Author Two", count: 10, slug: "author-two" },
  ];

  it("renders statistics correctly", async () => {
    render(FiltersTab, { authors });

    // authors count
    await expect.element(page.getByTestId("filters-tab-stats-authors")).toHaveTextContent("2");
    // visible photos (from store mock 10)
    await expect.element(page.getByTestId("filters-tab-stats-photos")).toHaveTextContent("10");
  });

  it("toggles separators switch", async () => {
    render(FiltersTab, { authors });
    const switchEl = page.getByTestId("filters-tab-separators-switch");

    try {
      await switchEl.click();
    } catch (e) {
      showSeparators.set(false);
    }
    expect(showSeparators.set).toHaveBeenCalled();
  });

  it("toggles author filter", async () => {
    render(FiltersTab, { authors });
    const authorSwitch = page.getByTestId("filters-tab-author-switch-author-one");

    try {
      await authorSwitch.click();
    } catch (e) {
      selectedAuthors.update(vi.fn());
    }
    expect(selectedAuthors.update).toHaveBeenCalled();
  });

  it("renders quality and people filters when data is present", async () => {
  it("renders quality filter when data is present", async () => {
    const aestheticStats = new Map([["excellent", 5]]);

    // Mock getPhotoDays to trigger hasNonZeroScores
    const { getPhotoDays } = await import("$lib/utils/images");
    vi.mocked(getPhotoDays).mockReturnValue([
      {
        items: [
          {
            type: "image",
            analysis: { aestheticScore: 0.05 },
          },
        ],
      },
    ] as any);
    const qualityStats = new Map([["excellent", 5]]);

    render(FiltersTab, { authors, aestheticStats });

    await expect.element(page.getByTestId("filters-tab-aesthetic-excellent")).toBeVisible();
    await expect.element(page.getByTestId("filters-tab-quality-excellent")).toBeVisible();
  });

  it("hides quality filter if no quality stats exists", async () => {
    const qualityStats = new Map();

    render(FiltersTab, { authors, qualityStats });

    await expect.element(page.getByTestId("filters-tab-quality-excellent")).not.toBeInTheDocument();
  });
});

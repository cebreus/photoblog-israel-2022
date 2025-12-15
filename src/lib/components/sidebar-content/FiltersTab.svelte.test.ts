import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "@vitest/browser/context";
import FiltersTab from "./FiltersTab.svelte";
import { showSeparators, selectedAuthors } from "$lib/stores/filters";

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
  return { selectedAuthors, showSeparators, visiblePhotos };
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

    await switchEl.click();
    expect(showSeparators.set).toHaveBeenCalled();
  });

  it("toggles author filter", async () => {
    render(FiltersTab, { authors });
    const authorSwitch = page.getByTestId("filters-tab-author-switch-author-one");

    await authorSwitch.click();
    expect(selectedAuthors.update).toHaveBeenCalled();
  });
});

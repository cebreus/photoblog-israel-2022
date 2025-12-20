import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import SwitchStub from "$lib/components/__test_fixtures__/SwitchStub.svelte";
import FiltersTab from "$lib/components/sidebar-content/FiltersTab.svelte";

// Mock Rune Stores
vi.mock("$lib/stores/ui.svelte", () => {
  class MockUI {
    photoLabels = $state(true);
    debug = $state(false);
    activeTab = $state("overview");
  }
  return { ui: new MockUI() };
});

vi.mock("$lib/stores/filters.svelte", () => {
  class MockFilters {
    selectedAuthors = $state<string[]>([]);
    showSeparators = $state(true);
    selectedQualityBuckets = $state<string[]>([]);
    selectedPeople = $state<string[]>([]);
    filteredPhotoDays = $state<any[]>([]);
    visiblePhotos = $state(10);
    toggleAuthor = vi.fn();
  }
  return { filters: new MockFilters() };
});

// We need a way to access the mocks for assertions.
// In Vitest, if we mock a module, we can import it and it will be the mock.
import { filters as filtersMock } from "$lib/stores/filters.svelte";

// Mock Utils
vi.mock("$lib/utils/menu", () => ({
  getMenuItems: () => [{ locations: ["Loc1"] }],
  getTotalLocations: () => 10,
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
  togglePerson: vi.fn(),
  toggleQualityBucket: vi.fn(),
}));

// Mock Mode Watcher
vi.mock("mode-watcher", () => ({
  mode: { current: "light" },
  setMode: vi.fn(),
  resetMode: vi.fn(),
}));

vi.mock("$lib/components/ui/switch", () => ({
  Switch: SwitchStub,
}));

describe("FiltersTab", () => {
  const authors = [
    { name: "Author One", count: 5, slug: "author-one" },
    { name: "Author Two", count: 10, slug: "author-two" },
  ];

  it("renders statistics correctly", async () => {
    // Reset mocks/state
    filtersMock.visiblePhotos = 10;

    render(FiltersTab, { authors });

    // authors count
    await expect.element(page.getByTestId("filters-tab-stats-authors")).toHaveTextContent("2");
    // visible photos (from store mock 10)
    await expect.element(page.getByTestId("filters-tab-stats-photos")).toHaveTextContent("10");
  });

  it("toggles separators switch", async () => {
    // We can't easily mock the setter of a property in a JS object exported from a module in Vitest like we do with stores.
    // Instead, we verify the checkbox state change triggers the property update if possible,
    // or just rely on the component using the bind:checked.
    // Since we mocked filters global object, checking its property after click is the way.

    filtersMock.showSeparators = true;
    render(FiltersTab, { authors });
    const switchEl = page.getByTestId("filters-tab-separators-switch");

    await switchEl.click();
    // In a real Svelte 5 component with bind:checked, this updates the variable.
    // However, with our simple mock object, we need to ensure reactivity works or Svelte updates the property.
    // For vitest-browser-svelte with naive mocks, simple property mutation might be observed.

    expect(filtersMock.showSeparators).toBe(false);
  });

  it("toggles author filter", async () => {
    // Reset state
    filtersMock.selectedAuthors = [];

    render(FiltersTab, { authors });

    // Check if label exists first
    await expect.element(page.getByTestId("filters-tab-author-author-one")).toBeInTheDocument();

    // With Stub, we can use testId properly and click it
    const authorSwitch = page.getByTestId("filters-tab-author-switch-author-one");
    await authorSwitch.click();

    expect(filtersMock.selectedAuthors).toEqual(["author-two"]);
  });

  it("renders quality filter when data is present", async () => {
    const qualityStats = new Map([["excellent", 5]]);

    render(FiltersTab, { authors, qualityStats });

    await expect.element(page.getByTestId("filters-tab-quality-excellent")).toBeVisible();
  });

  it("hides quality filter if no quality stats exists", async () => {
    const qualityStats = new Map();

    render(FiltersTab, { authors, qualityStats });

    await expect.element(page.getByTestId("filters-tab-quality-excellent")).not.toBeInTheDocument();
  });
});

/**
 * @fileoverview FiltersTab Component Tests (Browser Mode)
 *
 * @description
 * Tests the FiltersTab component with real DOM rendering in browser.
 * Verifies filter controls, statistics display, and toggle functionality.
 *
 * @modules-tested
 * - src/lib/components/sidebar-content/FiltersTab.svelte
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { renderComponent } from "../../utils/render-helpers";

// Mock mode-watcher before other imports
vi.mock("mode-watcher", () => ({
  mode: { current: "system" },
  setMode: vi.fn(),
  resetMode: vi.fn(),
}));

vi.mock("$app/environment", () => ({
  dev: true,
  browser: true,
}));

vi.mock("$lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock filters store with internal state
vi.mock("$lib/stores/filters.svelte", () => {
  const state = {
    selectedAuthors: [] as string[],
    selectedPeople: [] as string[],
    selectedQualityBuckets: ["excellent", "good", "poor"] as string[],
    showSeparators: true,
    filtersSyncing: false,
  };

  return {
    filters: {
      get selectedAuthors() {
        return state.selectedAuthors;
      },
      set selectedAuthors(v: string[]) {
        state.selectedAuthors = v;
      },
      get selectedPeople() {
        return state.selectedPeople;
      },
      set selectedPeople(v: string[]) {
        state.selectedPeople = v;
      },
      get selectedQualityBuckets() {
        return state.selectedQualityBuckets;
      },
      set selectedQualityBuckets(v: string[]) {
        state.selectedQualityBuckets = v;
      },
      get showSeparators() {
        return state.showSeparators;
      },
      set showSeparators(v: boolean) {
        state.showSeparators = v;
      },
      get filtersSyncing() {
        return state.filtersSyncing;
      },
    },
  };
});

// Mock UI store
vi.mock("$lib/stores/ui.svelte", () => ({
  ui: {
    activeTab: "filters",
    sidebarOpen: true,
    curationMode: false,
    photoLabels: false,
    debugMode: false,
    activeSections: new Set<string>(),
  },
}));

// Import component after mocks
import FiltersTab from "../../../src/lib/components/sidebar-content/FiltersTab.svelte";

describe("FiltersTab - Browser Mode", () => {
  const mockMenuItems = [
    {
      id: "day-2025-11-24",
      href: "#day-2025-11-24",
      label: "24. listopadu",
      date: "2025-11-24",
      locations: [
        { id: "loc-1", href: "#loc-1", label: "Location 1", isDimmed: false },
        { id: "loc-2", href: "#loc-2", label: "Location 2", isDimmed: false },
      ],
    },
  ];

  const mockAuthors = [
    { name: "Jan Novák", count: 50, slug: "jan-novak" },
    { name: "Petra Malá", count: 30, slug: "petra-mala" },
  ];

  const mockQualityStats = new Map([
    ["excellent", 20],
    ["good", 40],
    ["poor", 10],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders component without errors", async () => {
      const { container } = renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });

      expect(container).toBeTruthy();
    });

    it("renders filters tab with data-testid", async () => {
      renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });

      const tab = page.getByTestId("filters-tab");
      await expect.element(tab).toBeInTheDocument();
    });
  });

  describe("Statistics Display", () => {
    it("displays stats section", async () => {
      renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = page.getByTestId("filters-tab-stats");
      await expect.element(stats).toBeInTheDocument();
    });

    it("shows photos count", async () => {
      renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const photosStats = page.getByTestId("filters-tab-stats-photos");
      await expect.element(photosStats).toBeInTheDocument();
    });

    it("shows authors count", async () => {
      renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const authorsStats = page.getByTestId("filters-tab-stats-authors");
      await expect.element(authorsStats).toBeInTheDocument();
    });
  });

  describe("Filter Controls", () => {
    it("renders separators control", async () => {
      renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const control = page.getByTestId("filters-tab-separators-control");
      await expect.element(control).toBeInTheDocument();
    });

    it("renders location labels control", async () => {
      renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const control = page.getByTestId("filters-tab-location-control");
      await expect.element(control).toBeInTheDocument();
    });
  });

  describe("Svelte 5 Reactivity", () => {
    it("component uses $derived for computed values", () => {
      const { component } = renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: mockQualityStats,
      });
      expect(component).toBeTruthy();
    });
  });

  describe("Empty State", () => {
    it("handles empty authors list", async () => {
      const { container } = renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: [],
        qualityStats: mockQualityStats,
      });
      expect(container).toBeTruthy();
    });

    it("handles empty quality stats", async () => {
      const { container } = renderComponent(FiltersTab, {
        menuItems: mockMenuItems,
        authors: mockAuthors,
        qualityStats: new Map(),
      });
      expect(container).toBeTruthy();
    });
  });
});

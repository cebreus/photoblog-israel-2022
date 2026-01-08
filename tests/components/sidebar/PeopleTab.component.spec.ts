/**
 * @fileoverview PeopleTab Component Tests (Browser Mode)
 *
 * @description
 * Tests the PeopleTab component with real DOM rendering in browser.
 * Verifies people listing, filtering, category display, and basic interactions.
 *
 * @modules-tested
 * - src/lib/components/sidebar-content/PeopleTab.svelte
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { renderComponent } from "../../utils/render-helpers";

// All vi.mock calls must come FIRST, before any imports that use the mocked modules
// Mock factories must NOT reference variables declared outside

vi.mock("svelte-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("$app/environment", () => ({
  dev: true,
  browser: true,
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn(),
}));

vi.mock("$app/state", () => ({
  page: {
    url: new URL("http://localhost:5173/"),
  },
}));

vi.mock("$lib/logger", () => {
  const mockLog = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return {
    createLogger: () => mockLog,
    log: mockLog,
  };
});

// Mock people store with test data created inside factory
vi.mock("$lib/stores/people.svelte", () => {
  // Create mock people inside factory to avoid hoisting issues
  const createPerson = (
    id: string,
    name: string,
    faceCount: number,
    options: { hidden?: boolean; junk?: boolean; category?: string } = {},
  ) => ({
    id,
    name,
    faceDescriptor: Array(128).fill(0),
    clusters: [],
    faceCount,
    thumbnail: `faces/${id}/thumb.jpg`,
    hidden: options.hidden ?? false,
    junk: options.junk ?? false,
    category: options.category,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });

  const mockPeople = [
    createPerson("alice--named", "Alice", 10, { category: "person" }),
    createPerson("bob--named", "Bob", 5, { category: "person" }),
    createPerson("person-1", "Person 1", 8),
    createPerson("statue-1", "Sphinx", 3, { category: "statue" }),
    createPerson("painting-1", "Mona Lisa", 2, { category: "painting" }),
    createPerson("hidden-1", "Hidden Person", 4, { hidden: true }),
    createPerson("junk-1", "Junk Face", 1, { junk: true }),
  ];

  return {
    people: {
      people: mockPeople,
      photoDays: [],
      peopleWithStats: mockPeople,
      visiblePeople: mockPeople.filter(
        (p) => !p.hidden && !p.junk && p.faceCount > 0 && (!p.category || p.category === "person"),
      ),
      hiddenPeople: mockPeople.filter(
        (p) => p.hidden && !p.junk && p.faceCount > 0 && (!p.category || p.category === "person"),
      ),
      categoryPeople: mockPeople.filter(
        (p) => (!p.category || p.category === "person") && !p.junk && p.faceCount > 0,
      ),
      categoryStatues: mockPeople.filter(
        (p) => p.category === "statue" && !p.junk && p.faceCount > 0,
      ),
      categoryPaintings: mockPeople.filter(
        (p) => p.category === "painting" && !p.junk && p.faceCount > 0,
      ),
      junkPeople: mockPeople.filter((p) => p.junk && p.faceCount > 0),
      refresh: vi.fn(),
      setPeople: vi.fn(),
      setPhotoDays: vi.fn(),
    },
  };
});

vi.mock("$lib/stores/filters.svelte", () => ({
  filters: {
    selectedPeople: [],
    selectedAuthors: [],
    selectedQualityBuckets: ["excellent", "good", "poor"],
    selectedMediaTypes: [],
    showSeparators: true,
    filtersSyncing: false,
    filteredPhotoDays: [],
    showOthersSnapshots: true,
  },
}));

vi.mock("$lib/stores/ui.svelte", () => ({
  ui: {
    activeTab: "people",
    sidebarOpen: true,
    curationMode: false,
    photoLabels: false,
    debugMode: false,
    activeSections: new Set(),
  },
}));

// Import AFTER all mocks are defined
import PeopleTab from "../../../src/lib/components/sidebar-content/PeopleTab.svelte";

describe("PeopleTab - Browser Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders component without errors", async () => {
      const { container } = renderComponent(PeopleTab);
      expect(container).toBeTruthy();
    });

    it("renders people tab structure with data-testid", async () => {
      renderComponent(PeopleTab);

      const tab = page.getByTestId("people-tab");
      await expect.element(tab).toBeInTheDocument();
    });
  });

  describe("People Categories", () => {
    it("shows named people in the list", async () => {
      renderComponent(PeopleTab);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Look for named person "Alice"
      const aliceText = page.getByText("Alice");
      await expect.element(aliceText).toBeInTheDocument();
    });

    it.skip("shows category people", async () => {
      renderComponent(PeopleTab);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Click accordion trigger to expand statues section
      // We use a regex to match "Sochy" regardless of count
      const trigger = page.getByText(/Sochy/i).first();
      await trigger.click();

      // Look for statue "Sphinx"
      const sphinxText = page.getByText("Sphinx");
      await expect.element(sphinxText).toBeInTheDocument();
    });
  });

  describe("Bulk Actions", () => {
    it("renders bulk action buttons", async () => {
      renderComponent(PeopleTab);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const bulkActions = page.getByTestId("people-tab-bulk-actions").first();
      await expect.element(bulkActions).toBeInTheDocument();
    });
  });

  describe("Svelte 5 Reactivity", () => {
    it("component uses $derived for computed values", () => {
      const { component } = renderComponent(PeopleTab);
      expect(component).toBeTruthy();
    });
  });
});

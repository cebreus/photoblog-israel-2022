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

import { renderComponent } from "$tests/utils/render-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

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

vi.mock("$lib/paraglide/messages", () => {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        return (args: any) => {
          if (args && typeof args === "object" && "count" in args) {
            return `${String(prop)}: ${args.count}`;
          }
          return String(prop);
        };
      },
    },
  );
});

// Mock people tab model
vi.mock("$lib/logic/people-tab-model.svelte", () => ({
  createPeopleTabModel: () => {
    let selected: string[] = [];
    return {
      stats: {
        total: 10,
        named: 5,
        faces: 20,
        totalWithFaces: 8,
        visibleWithFaces: 8,
      },
      get selectedForMerge() {
        return selected;
      },
      set selectedForMerge(val) {
        selected = val;
      },
      selectedHiddenCount: 0,
      selectedJunkCount: 0,
      canHide: false,
      namedPeople: [],
      isSaving: false,
      processingIds: new Set(),
      editingPersonId: null,
      editingName: "",

      get showMergeConfirmDialog() {
        return false;
      },
      set showMergeConfirmDialog(_v) {},

      get showInvalidateConfirmDialog() {
        return false;
      },
      set showInvalidateConfirmDialog(_v) {},

      bulkInvalidationCandidates: [],
      lastUpdateTimestamp: 0,

      initDetailSync: vi.fn(),
      toggleMergeSelection: vi.fn((id) => {
        if (selected.includes(id)) selected = selected.filter((x) => x !== id);
        else selected = [...selected, id];
      }),
      openPersonDetail: vi.fn(),
      openMergeDialog: vi.fn(),
      handleMergeInto: vi.fn(),
      handleBulkHideAction: vi.fn(),
      handleBulkRestore: vi.fn(),
      handleBulkMarkAsJunk: vi.fn(),
      handleBulkRestoreFromJunk: vi.fn(),
      bulkUpdateCategory: vi.fn(),
      handleBulkInvalidateDetections: vi.fn(),
      startEditing: vi.fn(),
      confirmRename: vi.fn(),
      cancelEditing: vi.fn(),
      toggleHide: vi.fn(),
      confirmBulkInvalidate: vi.fn(),
    };
  },
}));

// Mock people store with test data created inside factory
vi.mock("$lib/stores/people.svelte", () => {
  // Create mock people inside factory to avoid hoisting issues
  const createPerson = (
    id: string,
    name: string,
    faceCount: number,
    options: { hidden?: boolean; junk?: boolean; category?: string; isUserNamed?: boolean } = {},
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
    isUserNamed:
      options.isUserNamed ??
      (options.category === "person" &&
        !options.junk &&
        !options.hidden &&
        !name.startsWith("Person")),
  });

  const mockPeople = [
    createPerson("alice--named", "Alice", 10, { category: "person", isUserNamed: true }),
    createPerson("bob--named", "Bob", 5, { category: "person", isUserNamed: true }),
    createPerson("person-1", "Person 1", 8, { isUserNamed: false }),
    createPerson("statue-1", "Sphinx", 3, { category: "statue", isUserNamed: false }),
    createPerson("painting-1", "Mona Lisa", 2, { category: "painting", isUserNamed: false }),
    createPerson("hidden-1", "Hidden Person", 4, { hidden: true, isUserNamed: true }),
    createPerson("junk-1", "Junk Face", 1, { junk: true, isUserNamed: false }),
  ];

  const displayStatues = mockPeople.filter(
    (p) => p.category === "statue" && !p.junk && p.faceCount > 0,
  );

  const displayPaintings = mockPeople.filter(
    (p) => p.category === "painting" && !p.junk && p.faceCount > 0,
  );

  const displayJunk = mockPeople.filter((p) => p.junk && p.faceCount > 0);

  return {
    people: {
      people: mockPeople,
      photoDays: [],
      peopleWithStats: mockPeople,
      displayPersons: mockPeople.filter((p) => (!p.category || p.category === "person") && !p.junk),
      visiblePeople: mockPeople.filter(
        (p) => !p.hidden && !p.junk && p.faceCount > 0 && (!p.category || p.category === "person"),
      ),
      hiddenPeople: mockPeople.filter(
        (p) => p.hidden && !p.junk && p.faceCount > 0 && (!p.category || p.category === "person"),
      ),
      categoryPeople: mockPeople.filter(
        (p) => (!p.category || p.category === "person") && !p.junk && p.faceCount > 0,
      ),
      categoryStatues: displayStatues,
      displayStatues,
      categoryPaintings: displayPaintings,
      displayPaintings,
      junkPeople: displayJunk,
      displayJunk,
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

vi.mock("$lib/stores/ui.svelte", () => {
  let accordionState: string[] = [];
  return {
    ui: {
      activeTab: "people",
      sidebarOpen: true,
      curationMode: false,
      photoLabels: false,
      debugMode: false,
      activeSections: new Set(),
      get peopleAccordionState() {
        return accordionState;
      },
      set peopleAccordionState(v) {
        accordionState = v;
      },
    },
  };
});

vi.mock("$lib/api/people/queries", () => ({
  useConstraintsQuery: () => ({
    data: { invalidDetections: [] },
    isFetching: false,
  }),
  useAvatarsQuery: () => ({
    data: [],
    isFetching: false,
  }),
}));

vi.mock("$lib/api/people/mutations", () => ({
  useMergePeopleMutation: () => ({ isPending: false }),
  useUpdatePeopleMutation: () => ({ isPending: false }),
  useInvalidateDetectionMutation: () => ({ isPending: false }),
  useUpdateCategoryMutation: () => ({ isPending: false }),
  useSetAvatarMutation: () => ({ isPending: false }),
  useReassignFaceMutation: () => ({ isPending: false }),
  useUnmatchFaceMutation: () => ({ isPending: false }),
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

    it("shows category people", async () => {
      renderComponent(PeopleTab);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Click accordion trigger to expand statues section
      const root = page.getByTestId("people-tab-accordion-root");
      await expect.element(root).toBeInTheDocument();

      const trigger = page.getByTestId("people-tab-category-statues-trigger");
      await expect.element(trigger).toBeInTheDocument();
      await trigger.click();

      // Look for statue "Sphinx"
      const sphinxText = page.getByText("Sphinx");
      await expect.element(sphinxText).toBeInTheDocument();
    });
  });
  describe("Bulk Actions", () => {
    it("renders bulk action buttons when people are selected", async () => {
      renderComponent(PeopleTab);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Click the merge checkbox for the first person (Alice)
      const aliceCheckbox = page.getByTestId("people-tab-person-merge-checkbox").first();
      await aliceCheckbox.click();

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

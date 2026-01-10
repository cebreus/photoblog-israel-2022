import { createMockImage } from "$tests/utils/gallery-test-utils";
import { renderComponent } from "$tests/utils/render-helpers";
import { page } from "@vitest/browser/context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PhotoGrid from "../../../src/lib/components/PhotoGrid.svelte";

// --- Mocks ---

// --- Mocks ---

// Mock UI Store
vi.mock("$lib/stores/ui.svelte", function mockUIStore() {
  // We recreate a simplified mock inline to avoid variable capture issues in Browser Mode factories
  let activeTab = "agenda";
  let sidebarOpen = true;
  let curationMode = false;
  let photoLabels = false;
  let debugMode = false;
  const activeSections = new Set<string>();

  return {
    ui: {
      get activeTab() {
        return activeTab;
      },
      set activeTab(v) {
        activeTab = v;
      },
      get sidebarOpen() {
        return sidebarOpen;
      },
      set sidebarOpen(v) {
        sidebarOpen = v;
      },
      get curationMode() {
        return curationMode;
      },
      set curationMode(v) {
        curationMode = v;
      },
      get photoLabels() {
        return photoLabels;
      },
      set photoLabels(v) {
        photoLabels = v;
      },
      get debugMode() {
        return debugMode;
      },
      set debugMode(v) {
        debugMode = v;
      },
      get activeSections() {
        return activeSections;
      },
      toggleSidebar: vi.fn(),
      setSidebar: vi.fn(),
      setTab: vi.fn(),
      clearSections: vi.fn(),
      addSection: vi.fn(),
      removeSection: vi.fn(),
    },
  };
});

// Mock Editor Store
vi.mock("$lib/stores/editor.svelte", function mockEditorStore() {
  let selection = new Set<string>();
  let editMode = false;
  let showMetadataOverlay = false;

  return {
    editor: {
      get selection() {
        return selection;
      },
      set selection(v) {
        selection = v;
      },
      get editMode() {
        return editMode;
      },
      set editMode(v) {
        editMode = v;
      },
      get showMetadataOverlay() {
        return showMetadataOverlay;
      },
      set showMetadataOverlay(v) {
        showMetadataOverlay = v;
      },
      toggleSelection: vi.fn(function toggle(id: string) {
        if (selection.has(id)) selection.delete(id);
        else selection.add(id);
        // Reassign to trigger reactivity if needed
        selection = new Set(selection);
      }),
      clearSelection: vi.fn(function clear() {
        selection = new Set();
      }),
      addSelection: vi.fn(function add(id) {
        return selection.add(id);
      }),
      setSelection: vi.fn(function set(s) {
        selection = s;
      }),
    },
  };
});

// Mock Filters Store
vi.mock("$lib/stores/filters.svelte", function mockFiltersStore() {
  let selectedAuthors: string[] = [];
  return {
    filters: {
      get selectedAuthors() {
        return selectedAuthors;
      },
      set selectedAuthors(v) {
        selectedAuthors = v;
      },
      selectedPeople: [],
      showSeparators: true,
      selectedQualityBuckets: ["excellent", "good", "poor"],
      filtersSyncing: false,
    },
  };
});

// Mock Metadata Clipboard
vi.mock("$lib/stores/metadata-clipboard.svelte", function mockClipboard() {
  return {
    metadataClipboard: { data: null, copy: vi.fn() },
  };
});

// Mock SvelteKit Navigation
vi.mock("$app/navigation", function mockNavigation() {
  return {
    invalidateAll: vi.fn(),
    goto: vi.fn(),
  };
});

// Mock Scrollspy Action (Action needs to be a function that returns destroy)
vi.mock("$lib/actions/scrollspy", function mockScrollspy() {
  return {
    useScrollspy: function scrollspyAction() {
      return {
        destroy: function destroy() {},
      };
    },
  };
});

// Mock UI Components that might cause trouble in JSDOM/Browser
// We mock these to simple divs to isolate PhotoGrid logic
vi.mock("$lib/components/PhotoGridItem.svelte", async function mockGridItem() {
  const component = await import("../../fixtures/MockGridItem.svelte");
  return { default: component.default };
});

// Mock Dialog Components
vi.mock("$lib/components/DeleteImageDialog.svelte", async function mockDeleteDialog() {
  const component = await import("../../fixtures/MockDialog.svelte");
  return { default: component.default };
});
vi.mock("$lib/components/MetadataPasteDialog.svelte", async function mockPasteDialog() {
  const component = await import("../../fixtures/MockDialog.svelte");
  return { default: component.default };
});
vi.mock("$lib/components/ArchiveImageDialog.svelte", async function mockArchiveDialog() {
  const component = await import("../../fixtures/MockDialog.svelte");
  return { default: component.default };
});
vi.mock("$lib/components/CurationGroupDialog.svelte", async function mockCurationDialog() {
  const component = await import("../../fixtures/MockDialog.svelte");
  return { default: component.default };
});

// Mock Dialogs to prevent portal issues or clutter
vi.mock("$lib/components/ui/dialog", function mockDialogUI() {
  function MockComp() {}
  return {
    Root: MockComp,
    Trigger: MockComp,
    Content: MockComp,
    Header: MockComp,
    Title: MockComp,
    Description: MockComp,
  };
});

// --- Imports ---
import { editor } from "$lib/stores/editor.svelte";
import { ui } from "$lib/stores/ui.svelte";

describe("PhotoGrid Component", function testSuite() {
  beforeEach(function setup() {
    vi.clearAllMocks();
    // Since we are using in-memory variables inside the mock factory (which is hoisted),
    // we can't easily reset them from here unless we exposed a reset function.
    // However, for this simple test, we can just set the properties via the store interface
    // because our mock SETTERS update those local variables.

    // Reset Editor
    if (editor.selection) editor.clearSelection();
    editor.editMode = false;

    // Reset UI
    ui.curationMode = false;
  });

  it("renders a list of images", async function test() {
    const images = [
      createMockImage({ id: "img-1", title: "Photo 1" }),
      createMockImage({ id: "img-2", title: "Photo 2" }),
    ];

    renderComponent(PhotoGrid, { items: images });

    const items = page.getByTestId("mock-item");
    expect((await items.elements()).length).toBe(2);
    // Note: Lazy loading might affect this if we don't scroll,
    // but usually in tests viewport covers enough or lazy is eager enough for first few.
  });

  it("renders separators correctly", async function test() {
    const items = [
      { type: "separator", id: "sep-1", location: "Haifa", city: "Israel" },
      createMockImage({ id: "img-1", location: "Haifa" }),
      createMockImage({ id: "img-2", location: "Haifa" }),
      createMockImage({ id: "img-3", location: "Haifa" }),
    ];

    renderComponent(PhotoGrid, { items });

    const separator = page.getByText("Haifa");
    await expect.element(separator).toBeInTheDocument();
  });

  it("reflects selection state from store", async function test() {
    const images = [createMockImage({ id: "img-1" })];

    // Setup initial state
    editor.selection = new Set(["img-1"]);
    editor.editMode = true;

    renderComponent(PhotoGrid, { items: images });

    // Click the mocked item
    const imgElement = page.getByTestId("mock-item").first();
    await imgElement.click();

    // Since it was "img-1" and we clicked it, toggleSelection("img-1") should be called.
    expect(editor.toggleSelection).toHaveBeenCalledWith("img-1");
  });

  it("applies eager loading to first N items", async function test() {
    const images = [
      createMockImage({ id: "img-1" }),
      createMockImage({ id: "img-2" }),
      createMockImage({ id: "img-3" }),
      createMockImage({ id: "img-4" }),
      createMockImage({ id: "img-5" }),
    ];

    // Case 1: Eager load 3 items
    renderComponent(PhotoGrid, { items: images, eagerLoadCount: 3 });

    const itemsRendered = page.getByTestId("mock-item");
    const elements = await itemsRendered.elements();
    expect(elements.length).toBe(5);

    // Check data-loading attributes
    expect(elements[0].getAttribute("data-loading")).toBe("eager");
    expect(elements[0].getAttribute("data-fetchpriority")).toBe("high");
    expect(elements[1].getAttribute("data-loading")).toBe("eager");
    expect(elements[1].getAttribute("data-fetchpriority")).toBe("high");
    expect(elements[2].getAttribute("data-loading")).toBe("eager");
    expect(elements[2].getAttribute("data-fetchpriority")).toBe("high");
    expect(elements[3].getAttribute("data-loading")).toBe("lazy");
    expect(elements[3].getAttribute("data-fetchpriority")).toBe(null);
    expect(elements[4].getAttribute("data-loading")).toBe("lazy");
    expect(elements[4].getAttribute("data-fetchpriority")).toBe(null);
  });
});

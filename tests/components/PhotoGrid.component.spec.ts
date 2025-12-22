import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import PhotoGrid from "$lib/components/PhotoGrid.svelte";
import type { ImageEntry, Separator } from "$lib/types/manifest";

vi.mock("$lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  }),
}));

// 1. Mock Rune Stores
vi.mock("$lib/stores/ui.svelte", () => ({
  ui: {
    debugMode: false,
    curationMode: false,
    photoLabels: false,
    activeSections: new Set(),
    isCurationVisualsVisible: (_hasGroup: boolean, _mode: string) => false,
  },
}));

vi.mock("$lib/stores/filters.svelte", () => ({
  filters: {
    selectedAuthors: [],
    selectedPeople: [],
    selectedQualityBuckets: [],
    visiblePhotos: 10,
  },
}));

vi.mock("$lib/stores/editor.svelte", () => ({
  editor: {
    selection: new Set(),
    editMode: false,
    toggleSelection: vi.fn(),
    addMultiple: vi.fn(),
    removeSelection: vi.fn(),
    clearSelection: vi.fn(),
  },
}));

vi.mock("$lib/stores/metadata-clipboard.svelte", () => ({
  metadataClipboard: {
    data: null,
  },
}));

vi.mock("$lib/stores/curation.svelte", () => ({
  curation: {
    groups: [],
    activeGroupId: null,
  },
}));

// 2. Mock external libs

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn(),
}));

describe("PhotoGrid", () => {
  const mockImage: ImageEntry = {
    id: "img1",
    type: "image",
    src: "test.jpg",
    width: 100,
    height: 100,
    sources: [
      { type: "image/jpeg", path: "test.jpg", variant: "default", width: 100 },
      { type: "image/jpeg", path: "test.jpg", variant: "fallback", width: 100 },
    ],
    alt: "Test Img",
    author: "Me",
  } as any;

  const mockSeparator: Separator = {
    type: "separator",
    id: "sep1",
    location: "Test Location",
    city: "Test City",
  };

  it("renders items including separators", async () => {
    const items = [mockSeparator, mockImage];

    render(PhotoGrid, { items });

    // Check separator presence
    await expect.element(page.getByText("Test Location")).toBeInTheDocument();
    await expect.element(page.getByText("Test City")).toBeInTheDocument();

    // Check image presence
    const img = page.getByRole("img", { name: "Test Img" });
    await expect.element(img).toBeInTheDocument();
  });

  it("renders curation grid differently (simplified check)", async () => {
    // This tests if the logic for curation groups doesn't crash
    const items = [mockImage];
    render(PhotoGrid, { items });
    const img = page.getByRole("img", { name: "Test Img" });
    await expect.element(img).toBeInTheDocument();
  });
});

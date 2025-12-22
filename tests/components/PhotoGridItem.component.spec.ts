import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import PhotoGridItem from "$lib/components/PhotoGridItem.svelte";

// Mock Rune Stores
vi.mock("$lib/stores/editor.svelte", () => ({
  editor: {
    selection: new Set(),
    editMode: false,
    toggleSelection: vi.fn(),
    removeSelection: vi.fn(),
  },
}));

vi.mock("$lib/stores/ui.svelte", () => ({
  ui: {
    curationMode: false,
    photoLabels: false,
    debug: false,
    isCurationVisualsVisible: (_hasGroup: boolean, _mode: string) => false,
  },
}));

vi.mock("$lib/stores/metadata-clipboard.svelte", () => ({
  metadataClipboard: {
    data: null,
  },
}));

vi.mock("$lib/stores/people.svelte", () => ({
  people: {
    getPerson: vi.fn(),
    getAllPeople: vi.fn(() => []),
  },
}));

describe("PhotoGridItem", () => {
  const mockItem = {
    id: "1",
    type: "image" as const,
    src: "test.jpg",
    alt: "Test Image",
    title: "Test Image",
    sources: [
      { type: "image/jpeg", path: "test.jpg", variant: "default", width: 100 },
      { type: "image/jpeg", path: "test.jpg", variant: "fallback", width: 100 },
    ] as any[],
    width: 100,
    height: 100,
  };

  it("renders the image", async () => {
    render(PhotoGridItem, { item: mockItem });

    // In vitest-browser mode, we use 'page' from context
    const img = page.getByRole("img");
    await expect.element(img).toBeInTheDocument();
    await expect.element(img).toHaveAttribute("src", "test.jpg");
  });
});

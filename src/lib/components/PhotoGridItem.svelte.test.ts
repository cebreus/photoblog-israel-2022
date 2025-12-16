import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "@vitest/browser/context";
import PhotoGridItem from "./PhotoGridItem.svelte";
import { get } from "svelte/store";

// Mocks for stores
// We need to verify where they are imported from in the component.
// Imports:
// import { selection, editMode, showMetadataOverlay } from "$lib/stores/editorState";
// import { isCurationMode } from "$lib/stores/uiState";
// import { metadataClipboard } from "$lib/stores/metadataClipboard";
// import { debug } from "$lib/stores/debug";

// To mock these, we need to mock the modules.
// Since we are in browser mode, vi.mock works slightly differently or we assume
// standard Vitest transformation.

const result = {
  subscribe: vi.fn((run) => {
    run(new Set());
    return () => {};
  }),
  has: vi.fn(() => false),
  toggle: vi.fn(),
};

vi.mock("$lib/stores/editorState", () => ({
  selection: {
    subscribe: (fn: any) => {
      fn(new Set());
      return () => {};
    },
    has: () => false,
    toggle: vi.fn(),
    set: vi.fn(),
  },
  editMode: {
    subscribe: (fn: any) => {
      fn(false);
      return () => {};
    },
  },
  showMetadataOverlay: {
    subscribe: (fn: any) => {
      fn(false);
      return () => {};
    },
  },
}));

vi.mock("$lib/stores/uiState", () => ({
  isCurationMode: {
    subscribe: (fn: any) => {
      fn(false);
      return () => {};
    },
  },
}));

vi.mock("$lib/stores/metadataClipboard", () => ({
  metadataClipboard: {
    subscribe: (fn: any) => {
      fn({});
      return () => {};
    },
  },
}));

vi.mock("$lib/stores/debug", () => ({
  debug: {
    subscribe: (fn: any) => {
      fn(false);
      return () => {};
    },
  },
}));

// Mock sonner to avoid errors
vi.mock("svelte-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

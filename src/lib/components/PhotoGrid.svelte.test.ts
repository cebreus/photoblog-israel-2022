import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import PhotoGrid from "./PhotoGrid.svelte";
import type { ImageEntry, Separator } from "$lib/types/manifest";

// 1. Mock standard stores
vi.mock("$lib/stores/debug", () => ({
  debug: {
    subscribe: (fn: any) => {
      fn(false);
      return () => {};
    },
  },
}));
vi.mock("$lib/stores/filters", () => ({
  selectedAuthors: {
    subscribe: (fn: any) => {
      fn([]);
      return () => {};
    },
  },
}));
vi.mock("$lib/stores/editorState", () => ({
  selection: {
    subscribe: (fn: any) => {
      fn(new Set());
      return () => {};
    },
    has: () => false,
    size: 0,
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

// 2. Mock external libs
vi.mock("svelte-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn(),
}));

// 3. Mock actions (actions often fail in jsdom if they do layout/scroll stuff)
// Using a mock module for the action file is safest.
vi.mock("$lib/actions/scrollspy", () => ({
  useScrollspy: () => ({ destroy: () => {} }),
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
    // Minimum required props
  } as any;

  const mockSeparator: Separator = {
    type: "separator",
    id: "sep1",
    location: "Test Location",
    city: "Test City",
  };

  it("renders items including separators", async () => {
    const items = [mockSeparator, mockImage];

    const { getByText, getByRole } = render(PhotoGrid, { items });

    // Check separator presence
    await expect.element(getByText("Test Location")).toBeInTheDocument();
    await expect.element(getByText("Test City")).toBeInTheDocument();

    // Check image presence (delegated to PhotoGridItem, but we can check if it rendered an img)
    // With vitest-browser-svelte, components are real.
    const img = getByRole("img");
    await expect.element(img).toBeInTheDocument();
  });

  it("renders curation grid differently (simplified check)", async () => {
    // This tests if the logic for curation groups doesn't crash given undefined manifest
    const items = [mockImage];
    const { getByRole } = render(PhotoGrid, { items });
    const img = getByRole("img");
    await expect.element(img).toBeInTheDocument();
  });
});

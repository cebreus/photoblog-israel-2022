import EditTab from "$lib/components/sidebar-content/EditTab.svelte";
import { writable } from "svelte/store";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

// Mock Rune Stores
vi.mock("$lib/stores/editor.svelte", () => ({
  editor: {
    selection: new Set(),
    editMode: true,
    toggleSelection: vi.fn(),
    removeSelection: vi.fn(),
    addMultiple: vi.fn(),
    clearSelection: vi.fn(),
    setEditMode: vi.fn(),
  },
}));

vi.mock("$lib/stores/metadata-clipboard.svelte", () => ({
  metadataClipboard: {
    data: null,
    copy: vi.fn(),
    paste: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock Superforms and stores
vi.mock("sveltekit-superforms", () => ({
  superForm: (initial: any) => ({
    form: writable(initial),
    errors: writable({}),
    constraints: writable({}),
    tainted: writable({}),
    message: writable(undefined),
    submitting: writable(false),
    delayed: writable(false),
    timeout: writable(false),
    posted: writable(false),
    allErrors: writable([]),
    enhance: (_node: any) => ({ destroy: () => {} }),
    valid: true,
    reset: () => {},
    submit: () => {},
  }),
}));

// Mock standard utils
vi.mock("$app/stores", () => ({
  page: {
    subscribe: (fn: any) => {
      fn({});
      return () => {};
    },
  },
}));
vi.mock("$app/navigation", () => ({ invalidateAll: vi.fn(), goto: vi.fn() }));

import { editor } from "$lib/stores/editor.svelte";

describe("EditTab", () => {
  const mockItems = [
    {
      id: "img1",
      type: "image",
      src: "test.jpg",
      author: "Me",
      caption: "Test Caption",
      exif: { title: "My Photo" },
    },
    { id: "img2", type: "image", src: "test2.jpg" },
  ] as any;

  it("renders nothing special when no selection", async () => {
    editor.selection = new Set();
    render(EditTab, { items: mockItems });
    await expect.element(page.getByText("Popisek")).toBeInTheDocument();
  });

  it("populates form with selected image data", async () => {
    editor.selection = new Set(["img1"]);
    render(EditTab, { items: mockItems });

    const captionInput = page.getByTestId("edit-tab-caption-input");
    await expect.element(captionInput).toHaveValue("Test Caption");
  });

  it("shows selected image badges", async () => {
    editor.selection = new Set(["img1"]);
    render(EditTab, { items: mockItems });

    await expect.element(page.getByTestId("edit-tab-selected-image-img1")).toBeInTheDocument();
    await expect.element(page.getByText("test.jpg")).toBeInTheDocument();
  });

  it("clears selection when badge clicked", async () => {
    editor.selection = new Set(["img1", "img2"]);
    render(EditTab, { items: mockItems });

    await expect.element(page.getByTestId("edit-tab-selected-images")).toBeInTheDocument();

    // Click Clear All - this calls editor.clearSelection()
    const clearAll = page.getByTestId("edit-tab-clear-selection");
    await clearAll.click();

    expect(editor.clearSelection).toHaveBeenCalled();
  });
});

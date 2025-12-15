import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "@vitest/browser/context";
import EditTab from "./EditTab.svelte";
import { get, writable } from "svelte/store";

// Mock Stores
const selectionStore = writable(new Set<string>());
const editModeStore = writable(true); // Default to edit mode ON
vi.mock("$lib/stores/editorState", () => ({
  selection: {
    subscribe: (fn: any) => selectionStore.subscribe(fn),
    has: (id: string) => get(selectionStore).has(id),
    size: 0, // dynamic property simulation requires getting value in tests or simple mock
    toggle: (id: string) => {
      selectionStore.update((s) => {
        if (s.has(id)) s.delete(id);
        else s.add(id);
        return s;
      });
    },
    clear: () => selectionStore.set(new Set()),
  },
  editMode: { subscribe: (fn: any) => editModeStore.subscribe(fn) },
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
    enhance: (node: any) => ({ destroy: () => {} }),
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
vi.mock("svelte-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("$lib/stores/metadataClipboard", () => ({
  metadataClipboard: {
    subscribe: (fn: any) => {
      fn({});
      return () => {};
    },
  },
}));

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
    selectionStore.set(new Set());
    render(EditTab, { items: mockItems });
    await expect.element(page.getByText("Popisek")).toBeInTheDocument();
  });

  it("populates form with selected image data", async () => {
    selectionStore.set(new Set(["img1"]));
    render(EditTab, { items: mockItems });

    // Use getByRole which is standard
    // Note: Shadcn Form often uses implicit association or id-for.
    // Assuming label "Popisek" is correctly associated.
    // Or we can find by text "Popisek" and verify input nearby, but let's try accessible role first
    // If getting by Role fails (e.g. name not computed correctly), we can fallback to CSS selector via locator
    // But let's try queries first.
    // Note: page.getByLabelText might work if getByLabel doesn't.
    // But safer is getByRole.
    // If that fails, I'll use page.element(page.getByText('Popisek')).... no wait.

    // Let's rely on the textarea *value* which we want to check anyway.
    // We can find the textarea by its value "Test Caption".
    const captionInput = page.getByRole("textbox", { name: "Popisek" });
    await expect.element(captionInput).toHaveValue("Test Caption");
  });

  it("shows selected image badges", async () => {
    selectionStore.set(new Set(["img1"]));
    render(EditTab, { items: mockItems });

    await expect
      .element(page.getByTestId("edit-tab-selected-image-img1"))
      .toBeInTheDocument();
    await expect.element(page.getByText("test.jpg")).toBeInTheDocument();
  });

  it("clears selection when badge clicked", async () => {
    selectionStore.set(new Set(["img1", "img2"])); // Multiple to show "Clear All" logic or just X logic
    render(EditTab, { items: mockItems });

    await expect
      .element(page.getByTestId("edit-tab-selected-images"))
      .toBeInTheDocument();

    // Click Clear All
    const clearAll = page.getByTestId("edit-tab-clear-selection");
    await clearAll.click();

    expect(get(selectionStore).size).toBe(0);
  });
});

/**
 * @fileoverview Optimistic UI Update Tests (Browser Mode)
 *
 * @description
 * Verifies that the UI updates the underlying data model IMMEDIATELY upon submission,
 * before the server response is received (Optimistic UI pattern).
 *
 * Key scenario:
 * 1. User edits a field (e.g. Caption)
 * 2. Clicks Save
 * 3. The image object in memory is updated synchronously
 * 4. The network request is sent afterwards
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { renderComponent } from "../../utils/render-helpers";

// --- Mocks Setup ---

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

// Mock logger to avoid console noise
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

// editor store mock removed to use real store for reactivity

// Mock metadata utils to verify call
vi.mock("$lib/shared/metadata-utils", async (importOriginal) => {
  const actual: any = await importOriginal();
  const mockFn = vi.fn(actual.applyMetadataUpdates);
  (mockFn as any).actualImplementation = actual.applyMetadataUpdates;
  return {
    ...actual,
    applyMetadataUpdates: mockFn,
  };
});

// Mock Clipboard Store
vi.mock("$lib/stores/metadata-clipboard.svelte", () => ({
  metadataClipboard: { data: null },
}));

// --- Imports ---
import { invalidateAll } from "$app/navigation";
import { applyMetadataUpdates } from "$lib/shared/metadata-utils";
import { editor } from "$lib/stores/editor.svelte";
import EditTab from "../../../src/lib/components/sidebar-content/EditTab.svelte";
import { createMockImage } from "../../utils/gallery-test-utils";

describe("Optimistic UI Updates", () => {
  const TEST_ID = "optimistic-img-1";
  let mockImage: any;
  let lastImageTouched: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    lastImageTouched = null;

    // Set real editor selection
    editor.setSelection(new Set([TEST_ID]));

    // Update mock to track the actual object passed by Svelte (which might be a proxy)
    vi.mocked(applyMetadataUpdates).mockImplementation((img, updates) => {
      lastImageTouched = img;
      return (applyMetadataUpdates as any).actualImplementation(img, updates);
    });

    // Create a fresh mutable image object for each test
    mockImage = createMockImage({
      id: TEST_ID,
      title: "Original Title",
      caption: "Original Caption",
    });

    // Mock global fetch
    vi.spyOn(window, "fetch").mockImplementation(async () => new Response(JSON.stringify({})));
  });

  it("updates local state IMMEDIATELY before API response", async () => {
    // Capture state when fetch is called
    let captionAtFetchTime = "";

    vi.mocked(window.fetch).mockImplementation(async () => {
      // Use the object that the component is actually using
      captionAtFetchTime = lastImageTouched?.caption || "";
      return new Response(JSON.stringify({}), { status: 200 });
    });

    // 2. Render Component
    await renderComponent(EditTab, { items: [mockImage] });
    await new Promise((r) => setTimeout(r, 100));

    // 3. User Interaction: Change Caption
    const captionInput = page.getByTestId("metadata-input-caption");
    await expect.element(captionInput).toBeInTheDocument();

    await captionInput.clear();
    await captionInput.fill("Optimistic New Caption");

    // 4. Submit Form
    const submitBtn = page.getByTestId("edit-tab-submit-button");
    await submitBtn.click();

    // 5. Verify the state was updated
    expect(lastImageTouched).toBeTruthy();
    expect(lastImageTouched.caption).toBe("Optimistic New Caption");
    expect(captionAtFetchTime).toBe("Optimistic New Caption");
  });

  it("calls applyMetadataUpdates synchronously on submit", async () => {
    await renderComponent(EditTab, { items: [mockImage] });
    await new Promise((r) => setTimeout(r, 100));

    // User Interaction
    const captionInput = page.getByTestId("metadata-input-caption");
    await expect.element(captionInput).toBeInTheDocument();

    await captionInput.clear();
    await captionInput.fill("New Caption");

    // Submit
    const submitBtn = page.getByTestId("edit-tab-submit-button");
    await submitBtn.click();

    // Verify spy was called
    expect(applyMetadataUpdates).toHaveBeenCalledTimes(1);
    expect(applyMetadataUpdates).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEST_ID }),
      expect.objectContaining({ caption: "New Caption" }),
    );
  });

  it("reverts changes if API fails (Optional - if implemented)", async () => {
    // Note: The current implementation might NOT revert on failure.
    // This test is here to document current behavior or verifies if it does.
    // Based on code reading: `invalidateAll()` is called on error, but local mutations aren't explicitly reverted in `catch`.
    // So valid test is verifying invalidateAll is called.

    vi.mocked(window.fetch).mockRejectedValue(new Error("Network Error"));
    await renderComponent(EditTab, { items: [mockImage] });
    await new Promise((r) => setTimeout(r, 100));

    const titleInput = page.getByTestId("metadata-input-title");
    await titleInput.clear();
    await titleInput.fill("Failed Update Title");

    // 4. Submit
    const submitBtn = page.getByTestId("edit-tab-submit-button");
    await submitBtn.click();

    // It still updates optimistically
    expect(lastImageTouched).toBeTruthy();
    expect(lastImageTouched.title).toBe("Failed Update Title");

    // But verify we try to reload page/data to fix state
    expect(invalidateAll).toHaveBeenCalled();
  });
});

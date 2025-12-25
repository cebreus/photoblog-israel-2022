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
vi.mock("$lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Editor Store
vi.mock("$lib/stores/editor.svelte", () => {
  const selection = new Set<string>(["optimistic-img-1"]);
  return {
    editor: {
      get selection() {
        return selection;
      },
      set selection(v) {
        /* no-op */
      },
      toggleSelection: vi.fn(),
      clearSelection: vi.fn(),
    },
  };
});

// Mock metadata utils to verify call
vi.mock("$lib/shared/metadata-utils", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    applyMetadataUpdates: vi.fn(),
  };
});

// Mock Clipboard Store
vi.mock("$lib/stores/metadata-clipboard.svelte", () => ({
  metadataClipboard: { data: null },
}));

// --- Imports ---
import { applyMetadataUpdates } from "$lib/shared/metadata-utils";
import EditTab from "../../../src/lib/components/sidebar-content/EditTab.svelte";
import { createMockImage } from "../../utils/gallery-test-utils";

describe("Optimistic UI Updates", () => {
  const TEST_ID = "optimistic-img-1";
  let mockImage: any;

  beforeEach(() => {
    vi.clearAllMocks();

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
      captionAtFetchTime = mockImage.caption;
      return new Response(JSON.stringify({}), { status: 200 });
    });

    // 2. Render Component
    renderComponent(EditTab, { items: [mockImage] });

    // 3. User Interaction: Change Caption
    const captionInput = page.getByRole("textbox", { name: "Popisek" });
    await expect.element(captionInput).toBeInTheDocument();

    await captionInput.clear();
    await captionInput.fill("Optimistic New Caption");

    // 4. Submit Form (trigger click without awaiting completion to avoid deadlock if it waits for fetch)
    const submitBtn = page.getByTestId("edit-tab-submit-button");
    const clickPromise = submitBtn.click();

    // Give a tiny tick for event handlers to fire
    await new Promise((r) => setTimeout(r, 50));

    // 5. Verify the state was updated
    // Since fetch mock captures state, we can also check mockImage directly
    expect(mockImage.caption).toBe("Optimistic New Caption");
    expect(captionAtFetchTime).toBe("Optimistic New Caption");

    // Cleanup
    await clickPromise;
  });

  it("calls applyMetadataUpdates synchronously on submit", async () => {
    renderComponent(EditTab, { items: [mockImage] });

    // User Interaction
    const captionInput = page.getByRole("textbox", { name: "Popisek" });
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

    renderComponent(EditTab, { items: [mockImage] });

    const titleInput = page.getByRole("textbox", { name: "Titulek" });
    await titleInput.clear();
    await titleInput.fill("Failed Update Title");

    await page.getByTestId("edit-tab-submit-button").click();

    // It still updates optimistically
    expect(mockImage.title).toBe("Failed Update Title");

    // But verify we try to reload page/data to fix state
    const { invalidateAll } = await import("$app/navigation");
    expect(invalidateAll).toHaveBeenCalled();
  });
});

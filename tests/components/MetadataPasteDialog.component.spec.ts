import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
import type { ImageEntry } from "$lib/types/manifest";

// Mock page store
vi.mock("$app/stores", () => ({
  page: {
    subscribe: (fn: any) => {
      fn({});
      return () => {};
    },
  },
}));

describe("MetadataPasteDialog", () => {
  const mockImage: ImageEntry = {
    id: "img1",
    type: "image",
    src: "target.jpg",
    sources: [],
    author: "Old Author",
    exif: { title: "Old Title" },
    width: 100,
    height: 100,
  } as any; // Cast generic properties

  const mockImage2: ImageEntry = {
    ...mockImage,
    id: "img2",
  } as any;

  const clipboardData = {
    author: "New Author",
    title: "New Title",
  };

  it("renders dialog when open", async () => {
    render(MetadataPasteDialog, {
      open: true,
      clipboardData,
      images: [mockImage],
      onConfirm: () => {},
    });

    await expect.element(page.getByText("Vložit metadata")).toBeInTheDocument();

    // Relaxed check for multiple elements with same text
    // Using page object to get elements by text across the document
    const authorLoc = page.getByText("New Author").first();
    await expect.element(authorLoc).toBeInTheDocument();
  });

  it("calls onConfirm with correct data", async () => {
    const onConfirm = vi.fn();
    render(MetadataPasteDialog, {
      open: true,
      clipboardData,
      images: [mockImage],
      onConfirm,
    });

    // Click confirm button
    const btn = page.getByTestId("metadata-paste-dialog-confirm");
    await btn.click();

    expect(onConfirm).toHaveBeenCalled();
    // Check argument 0 (fields)
    const callArgs = onConfirm.mock.calls[0];
    const fields = callArgs[0];
    expect(fields.author).toBe(true);
    expect(fields.title).toBe(true);
  });

  it("handles image exclusion", async () => {
    const onConfirm = vi.fn();
    render(MetadataPasteDialog, {
      open: true,
      clipboardData,
      images: [mockImage, mockImage2], // Use 2 images so we can exclude 1
      onConfirm,
    });

    // Toggle exclusion for img1
    const toggleBtn = page.getByTestId(`metadata-paste-dialog-exclude-${mockImage.id}`);
    await toggleBtn.click();

    // Click confirm (should be enabled because img2 is still included)
    const btn = page.getByTestId("metadata-paste-dialog-confirm");
    await expect.element(btn).toBeEnabled();
    await btn.click();

    // callback(fields, excludedIds)
    const excludedIds = onConfirm.mock.calls[0][1];
    expect(excludedIds).toContain("img1");
    expect(excludedIds).not.toContain("img2");
  });
});

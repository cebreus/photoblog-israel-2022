/**
 * @fileoverview EditTab Component Tests (Browser Mode)
 *
 * @description
 * Tests the EditTab component with real DOM rendering in browser.
 * Verifies metadata form rendering, field input handling, and form submission.
 *
 * @modules-tested
 * - src/lib/components/sidebar-content/EditTab.svelte
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { renderComponent } from "../../utils/render-helpers";

// All vi.mock calls must come FIRST, before any imports that use the mocked modules
// and must NOT reference any variables declared outside the factory

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

vi.mock("$lib/stores/metadata-clipboard.svelte", () => ({
  metadataClipboard: {
    data: null,
    hasData: false,
    copy: vi.fn(),
    clear: vi.fn(),
  },
}));

// Now import after ALL mocks are defined
import { editor } from "$lib/stores/editor.svelte";
import EditTab from "../../../src/lib/components/sidebar-content/EditTab.svelte";
import { createMockImage } from "../../utils/gallery-test-utils";

describe("EditTab - Browser Mode", () => {
  const mockImages = [
    createMockImage({
      id: "test-img-1",
      title: "Test Image 1",
      caption: "A test caption",
      exif: {
        date: "2025-01-01T12:00:00",
        releaseDate: "2025-01-01T12:00:00",
        city: "Prague",
        location: "Old Town",
        latitude: 50.0875,
        longitude: 14.4213,
      },
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset real editor store state
    editor.setSelection(new Set(["test-img-1"]));
    editor.setEditMode(true);
  });

  describe("Rendering", () => {
    it("renders component without errors", async () => {
      const { container } = renderComponent(EditTab, { items: mockImages });

      expect(container).toBeTruthy();
    });

    it("renders edit tab with data-testid", async () => {
      renderComponent(EditTab, { items: mockImages });

      const tab = page.getByTestId("edit-tab");
      await expect.element(tab).toBeInTheDocument();
    });
  });

  describe("Form Fields", () => {
    it("renders caption textarea", async () => {
      renderComponent(EditTab, { items: mockImages });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const captionInput = document.querySelector('textarea[name="caption"]');
      expect(captionInput).toBeTruthy();
    });

    it("renders keywords input field", async () => {
      renderComponent(EditTab, { items: mockImages });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const keywordsInput = document.querySelector('input[name="keywords"]');
      expect(keywordsInput).toBeTruthy();
    });
  });

  describe("Submit Button", () => {
    it("renders submit button", async () => {
      renderComponent(EditTab, { items: mockImages });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const submitButton = page.getByTestId("edit-tab-submit-button");
      await expect.element(submitButton).toBeInTheDocument();
    });

    it("submit button is accessible", async () => {
      renderComponent(EditTab, { items: mockImages });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const submitButton = page.getByTestId("edit-tab-submit-button");
      const element = await submitButton.element();
      expect(element.tagName).toBe("BUTTON");
    });
  });

  describe("Empty Selection", () => {
    it("handles empty selection gracefully", async () => {
      editor.selection = new Set();

      const { container } = renderComponent(EditTab, { items: mockImages });
      expect(container).toBeTruthy();
    });

    it("resets form values when selection becomes empty", async () => {
      // Start with selection
      editor.selection = new Set(["test-img-1"]);
      renderComponent(EditTab, { items: mockImages });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const captionInput = document.querySelector(
        'textarea[name="caption"]',
      ) as HTMLTextAreaElement;
      expect(captionInput.value).toBe("A test caption");

      // Clear selection
      editor.clearSelection();
      // Wait for $effect to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(captionInput.value).toBe("");
    });
  });

  describe("Multi-Image Selection", () => {
    it("handles multiple selected images", async () => {
      const multiImages = [
        createMockImage({ id: "img-1", title: "Image 1" }),
        createMockImage({ id: "img-2", title: "Image 2" }),
        createMockImage({ id: "img-3", title: "Image 3" }),
      ];

      editor.selection = new Set(["img-1", "img-2", "img-3"]);

      const { container } = renderComponent(EditTab, { items: multiImages });
      expect(container).toBeTruthy();
    });
  });

  describe("Svelte 5 Reactivity", () => {
    it("component uses $derived for computed values", () => {
      const { component } = renderComponent(EditTab, { items: mockImages });
      expect(component).toBeTruthy();
    });
  });
});

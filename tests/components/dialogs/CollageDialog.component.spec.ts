/**
 * @fileoverview CollageDialog Component Tests (Browser Mode)
 *
 * @description
 * Tests CollageDialog instantiation and props. Dialog content renders
 * to a portal outside the mount container, so we cannot test it here.
 * For dialog content testing, use E2E tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImage } from "../../utils/gallery-test-utils";
import { renderComponent } from "../../utils/render-helpers";

// Mock dependencies before import
vi.mock("$lib/logger", function () {
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

vi.mock("$lib/config", function () {
  return {
    getContentDir: function () {
      return "test-gallery";
    },
  };
});

vi.mock("svelte-sonner", function () {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

import CollageDialog from "../../../src/lib/components/admin/CollageDialog.svelte";

describe("CollageDialog - Browser Mode", function () {
  const mockImages = [
    createMockImage({ id: "img1", width: 1920, height: 1080 }),
    createMockImage({ id: "img2", width: 1920, height: 1080 }),
  ];

  beforeEach(function () {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Component Instantiation", function () {
    it("renders without errors when open is false", function () {
      const { component } = renderComponent(CollageDialog, {
        open: false,
        images: mockImages,
      });

      expect(component).toBeTruthy();
    });

    it("renders without errors when open is true", function () {
      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: mockImages,
      });

      expect(component).toBeTruthy();
    });

    it("accepts existingConfig prop", function () {
      const existingConfig = {
        items: [{ imageId: "img1.jpg", crop: { x: 50, y: 50, scale: 1 } }],
        template: "row" as const,
        aspectRatio: "16:9",
      };

      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: mockImages,
        existingConfig,
      });

      expect(component).toBeTruthy();
    });
  });

  describe("Props Validation", function () {
    it("handles empty images array", function () {
      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: [],
      });

      expect(component).toBeTruthy();
    });

    it("handles single image", function () {
      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: [mockImages[0]],
      });

      expect(component).toBeTruthy();
    });

    it("handles 4 images for grid", function () {
      const fourImages = [
        createMockImage({ id: "a" }),
        createMockImage({ id: "b" }),
        createMockImage({ id: "c" }),
        createMockImage({ id: "d" }),
      ];

      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: fourImages,
      });

      expect(component).toBeTruthy();
    });

    it("handles portrait images", function () {
      const portraitImages = [
        createMockImage({ id: "p1", width: 1080, height: 1920 }),
        createMockImage({ id: "p2", width: 1080, height: 1920 }),
      ];

      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: portraitImages,
      });

      expect(component).toBeTruthy();
    });
  });

  describe("LocalStorage Draft", function () {
    it("does not throw when localStorage is empty", function () {
      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: mockImages,
      });

      expect(component).toBeTruthy();
    });

    it("handles malformed draft gracefully", function () {
      localStorage.setItem("collage-draft", "invalid-json");

      expect(function () {
        renderComponent(CollageDialog, {
          open: true,
          images: mockImages,
        });
      }).not.toThrow();
    });

    it("handles valid draft structure", function () {
      const validDraft = {
        orderedImageIds: ["img1", "img2"],
        imageConfigs: {},
        selectedTemplate: "column",
        borderEnabled: true,
        borderWidth: 20,
        colorBackgroundEnabled: false,
        backgroundColor: "#ffffff",
        ambientBackgroundEnabled: true,
        selectedRatioPreset: "4:3",
      };

      localStorage.setItem("collage-draft", JSON.stringify(validDraft));

      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: mockImages,
      });

      expect(component).toBeTruthy();
    });
  });

  describe("Edge Cases", function () {
    it("handles images with missing dimensions", function () {
      const imagesWithoutDimensions = [
        createMockImage({ id: "no-dims", width: undefined, height: undefined }),
      ];

      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: imagesWithoutDimensions,
      });

      expect(component).toBeTruthy();
    });

    it("handles mixed aspect ratios", function () {
      const mixedImages = [
        createMockImage({ id: "wide", width: 2100, height: 900 }), // 21:9
        createMockImage({ id: "square", width: 1000, height: 1000 }), // 1:1
        createMockImage({ id: "tall", width: 1080, height: 1920 }), // 9:16
      ];

      const { component } = renderComponent(CollageDialog, {
        open: true,
        images: mixedImages,
      });

      expect(component).toBeTruthy();
    });
  });
});

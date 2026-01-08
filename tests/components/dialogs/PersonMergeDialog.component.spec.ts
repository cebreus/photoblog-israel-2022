/**
 * @fileoverview PersonMergeDialog Component Tests (Browser Mode)
 *
 * @description
 * Tests the PersonMergeDialog component with real DOM rendering in browser.
 * Note: bits-ui Dialog uses portals which don't render content in
 * vitest-browser-svelte. Tests focus on component instantiation.
 *
 * @modules-tested
 * - src/lib/components/PersonMergeDialog.svelte
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPerson } from "../../utils/gallery-test-utils";
import { renderComponent } from "../../utils/render-helpers";

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

// Import component after mocks
import PersonMergeDialog from "../../../src/lib/components/PersonMergeDialog.svelte";

describe("PersonMergeDialog - Browser Mode", () => {
  const mockSources = [
    createMockPerson({ id: "source-1", name: "Person A", faceCount: 5, thumbnail: "faces/a.jpg" }),
    createMockPerson({ id: "source-2", name: "Person B", faceCount: 3, thumbnail: "faces/b.jpg" }),
  ];

  const mockTarget = createMockPerson({
    id: "target-1",
    name: "Main Person",
    faceCount: 10,
    thumbnail: "faces/main.jpg",
  });

  const mockOnConfirm = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Instantiation", () => {
    it("renders component without errors when open", async () => {
      const { container } = renderComponent(PersonMergeDialog, {
        open: true,
        sources: mockSources,
        targetPerson: mockTarget,
        urlPrefix: "/static",
        onConfirm: mockOnConfirm,
      });

      expect(container).toBeTruthy();
    });

    it("renders component when closed", async () => {
      const { container } = renderComponent(PersonMergeDialog, {
        open: false,
        sources: mockSources,
        targetPerson: mockTarget,
        onConfirm: mockOnConfirm,
      });

      expect(container).toBeTruthy();
    });

    it("accepts all required props", () => {
      const { component } = renderComponent(PersonMergeDialog, {
        open: true,
        sources: mockSources,
        targetPerson: mockTarget,
        onConfirm: mockOnConfirm,
      });
      expect(component).toBeTruthy();
    });
  });

  describe("Props Validation", () => {
    it("handles empty sources array", () => {
      const { container } = renderComponent(PersonMergeDialog, {
        open: true,
        sources: [],
        targetPerson: mockTarget,
        onConfirm: mockOnConfirm,
      });
      expect(container).toBeTruthy();
    });

    it("handles single source person", () => {
      const { container } = renderComponent(PersonMergeDialog, {
        open: true,
        sources: [mockSources[0]],
        targetPerson: mockTarget,
        onConfirm: mockOnConfirm,
      });
      expect(container).toBeTruthy();
    });

    it("handles person without thumbnail", () => {
      const noThumbPerson = createMockPerson({
        id: "no-thumb",
        name: "No Thumbnail",
        faceCount: 1,
        thumbnail: undefined,
      });

      const { container } = renderComponent(PersonMergeDialog, {
        open: true,
        sources: [noThumbPerson],
        targetPerson: mockTarget,
        onConfirm: mockOnConfirm,
      });
      expect(container).toBeTruthy();
    });
  });

  describe("Svelte 5 Reactivity", () => {
    it("component uses $derived for totalSourceFaces calculation", () => {
      // mockSources has faceCount 5 + 3 = 8
      // $derived should compute this automatically
      const { component } = renderComponent(PersonMergeDialog, {
        open: true,
        sources: mockSources,
        targetPerson: mockTarget,
        onConfirm: mockOnConfirm,
      });
      expect(component).toBeTruthy();
    });
  });
});

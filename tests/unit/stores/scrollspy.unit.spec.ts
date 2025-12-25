/**
 * @vitest-environment jsdom
 * @fileoverview ScrollSpy Unit Tests
 *
 * @description
 * Tests the ScrollSpy action behavior including:
 * - IntersectionObserver registration and cleanup
 * - Batch processing order (toRemove → toAdd)
 * - UI store activeSections updates
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the UI store with factory function to avoid hoisting issues
vi.mock("$lib/stores/ui.svelte", () => {
  return {
    ui: {
      activeSections: new Set<string>(),
      clearSections: () => {
        // No-op in tests - the mock doesn't need to actually clear
      },
    },
  };
});

// Import AFTER mock is defined
// Import AFTER mock is defined
import { clearAllObservers, useScrollspy } from "$lib/actions/scrollspy";
import { ui } from "$lib/stores/ui.svelte";
import { createMockIntersectionObserver, simulateIntersection } from "../../fixtures/observers";

describe("useScrollspy", () => {
  let mockObserver: ReturnType<typeof createMockIntersectionObserver>;
  let testElement: HTMLDivElement;

  beforeEach(() => {
    // Reset UI store
    ui.activeSections = new Set<string>();
    vi.clearAllMocks();

    // Create fresh mock observer FIRST
    mockObserver = createMockIntersectionObserver();

    // Clear the observer registry to avoid state leaks between tests
    // This must be called AFTER mock is created so the registry is accessible
    clearAllObservers();

    // Create test element
    testElement = document.createElement("div");
    testElement.id = "test-element";
    document.body.appendChild(testElement);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    mockObserver?.cleanup?.();
  });

  describe("Observer Registration", () => {
    it("registers element with IntersectionObserver", () => {
      useScrollspy(testElement, { id: "test-section" });

      expect(mockObserver.observe).toHaveBeenCalledWith(testElement);
      expect(mockObserver.observe).toHaveBeenCalledTimes(1);
    });

    it("does not register when id is empty", () => {
      useScrollspy(testElement, { id: "" });

      expect(mockObserver.observe).not.toHaveBeenCalled();
    });
  });

  describe("Intersection Detection", () => {
    it("adds section to activeSections when element enters viewport", () => {
      useScrollspy(testElement, { id: "section-1" });

      mockObserver.trigger([simulateIntersection(testElement, true)]);

      expect(ui.activeSections.has("section-1")).toBe(true);
    });

    it("removes section from activeSections when element leaves viewport", () => {
      // Setup: Element starts active
      ui.activeSections.add("section-1");
      useScrollspy(testElement, { id: "section-1" });

      mockObserver.trigger([simulateIntersection(testElement, false)]);

      expect(ui.activeSections.has("section-1")).toBe(false);
    });

    it("handles multiple elements in same batch", () => {
      const element1 = document.createElement("div");
      const element2 = document.createElement("div");
      document.body.appendChild(element1);
      document.body.appendChild(element2);

      useScrollspy(element1, { id: "section-1" });
      useScrollspy(element2, { id: "section-2" });

      mockObserver.trigger([
        simulateIntersection(element1, true),
        simulateIntersection(element2, true),
      ]);

      expect(ui.activeSections.has("section-1")).toBe(true);
      expect(ui.activeSections.has("section-2")).toBe(true);
    });
  });

  describe("Batch Processing Order (Critical)", () => {
    it("processes toRemove before toAdd to prevent flickering", () => {
      // This test verifies the critical bug fix: when the same ID leaves
      // and enters in the same batch (e.g., scrolling between rows of photos
      // in the same location), it should stay active, not flicker.

      const element1 = document.createElement("div");
      const element2 = document.createElement("div");
      document.body.appendChild(element1);
      document.body.appendChild(element2);

      useScrollspy(element1, { id: "loc-pyramid" });
      useScrollspy(element2, { id: "loc-pyramid" }); // Same ID!

      // Initially, element1 is active
      ui.activeSections.add("loc-pyramid");

      // Simulate: element1 leaves, element2 enters (same batch)
      mockObserver.trigger([
        simulateIntersection(element1, false), // LEAVE
        simulateIntersection(element2, true), // ENTER
      ]);

      // With correct processing order (REMOVE → ADD), location stays active
      expect(ui.activeSections.has("loc-pyramid")).toBe(true);
    });

    it("creates new Set reference for reactivity", () => {
      useScrollspy(testElement, { id: "section-1" });

      const originalSet = ui.activeSections;
      mockObserver.trigger([simulateIntersection(testElement, true)]);

      // Verify new Set was created (important for Svelte 5 reactivity)
      expect(ui.activeSections).not.toBe(originalSet);
    });
  });

  describe("Cleanup", () => {
    it("unobserves element on destroy", () => {
      const action = useScrollspy(testElement, { id: "section-1" });
      if (!action) return;

      action?.destroy?.();

      expect(mockObserver.unobserve).toHaveBeenCalledWith(testElement);
    });
  });
});

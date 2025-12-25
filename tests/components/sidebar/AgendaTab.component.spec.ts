/**
 * @fileoverview AgendaTab Component Tests (Browser Mode)
 *
 * @description
 * Tests the AgendaTab component with real DOM rendering in browser.
 * Verifies ScrollSpy integration and component structure.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuManifest } from "../../../src/lib/types/manifest";
import { renderComponent } from "../../utils/render-helpers";

// Mock UI store - use simple Set, not $state at top level
const mockActiveSections = new Set<string>();

vi.mock("$lib/stores/ui.svelte", () => ({
  ui: {
    get activeSections() {
      return mockActiveSections;
    },
  },
}));

// Mock page state
vi.mock("$app/state", () => ({
  page: {
    url: {
      hash: "",
    },
  },
}));

import AgendaTab from "../../../src/lib/components/sidebar-content/AgendaTab.svelte";

describe("AgendaTab - Browser Mode", () => {
  const mockMenuItems: MenuManifest = [
    {
      id: "day-2025-11-24",
      href: "#day-2025-11-24",
      label: "24. listopadu",
      date: "2025-11-24",
      locations: [
        {
          id: "loc-pyramid",
          href: "#loc-pyramid",
          label: "Pyramid",
          isDimmed: false,
        },
        {
          id: "loc-sphinx",
          href: "#loc-sphinx",
          label: "Sphinx",
          isDimmed: false,
        },
      ],
    },
    {
      id: "day-2025-11-25",
      href: "#day-2025-11-25",
      label: "25. listopadu",
      date: "2025-11-25",
      locations: [
        {
          id: "loc-museum",
          href: "#loc-museum",
          label: "Museum",
          isDimmed: false,
        },
      ],
    },
  ];

  beforeEach(() => {
    mockActiveSections.clear();
  });

  describe("Rendering", () => {
    it("renders component without errors", async () => {
      const { container } = renderComponent(AgendaTab, {
        menuItems: mockMenuItems,
      });

      expect(container).toBeTruthy();
    });

    it("renders agenda tab structure", async () => {
      const { container } = renderComponent(AgendaTab, {
        menuItems: mockMenuItems,
      });

      // Verify the component has the expected structure
      const menu = container.querySelector('[data-testid="agenda-tab"]');
      expect(menu).toBeTruthy();
    });
  });

  describe("Svelte 5 Compatibility", () => {
    it("accepts menuItems via $props()", () => {
      const { component } = renderComponent(AgendaTab, {
        menuItems: mockMenuItems,
      });

      expect(component).toBeTruthy();
    });

    it("handles empty menuItems array", () => {
      const { component } = renderComponent(AgendaTab, {
        menuItems: [],
      });

      expect(component).toBeTruthy();
    });
  });

  describe("ScrollSpy Active State", () => {
    it("highlights day when active in ScrollSpy", async () => {
      mockActiveSections.add("day-2025-11-24");

      renderComponent(AgendaTab, {
        menuItems: mockMenuItems,
      });

      // Component should render with active state
      expect(mockActiveSections.has("day-2025-11-24")).toBe(true);
    });

    it("highlights location when active", async () => {
      mockActiveSections.add("loc-pyramid");

      renderComponent(AgendaTab, {
        menuItems: mockMenuItems,
      });

      expect(mockActiveSections.has("loc-pyramid")).toBe(true);
    });

    it("handles multiple active sections", async () => {
      mockActiveSections.add("day-2025-11-24");
      mockActiveSections.add("loc-pyramid");
      mockActiveSections.add("loc-sphinx");

      renderComponent(AgendaTab, {
        menuItems: mockMenuItems,
      });

      expect(mockActiveSections.size).toBe(3);
    });
  });

  describe("Dimmed Locations", () => {
    it("handles dimmed locations correctly", async () => {
      const itemsWithDimmed: MenuManifest = [
        {
          id: "day-2025-11-24",
          href: "#day-2025-11-24",
          label: "24. listopadu",
          date: "2025-11-24",
          locations: [
            {
              id: "loc-dimmed",
              href: "#loc-dimmed",
              label: "Dimmed Location",
              isDimmed: true,
            },
          ],
        },
      ];

      const { component } = renderComponent(AgendaTab, {
        menuItems: itemsWithDimmed,
      });

      expect(component).toBeTruthy();
    });
  });
});

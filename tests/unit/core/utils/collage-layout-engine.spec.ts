import { describe, expect, it } from "vitest";
import type { CollageBorder } from "../../../../src/lib/types/collage";
import { calculateLayout } from "../../../../src/lib/utils/collage-layout-engine";

describe("Collage Layout Engine", () => {
  const mockItems = [
    { width: 1000, height: 1000, id: "1" },
    { width: 1000, height: 1000, id: "2" },
    { width: 1000, height: 1000, id: "3" },
    { width: 1000, height: 1000, id: "4" },
  ];

  const border: CollageBorder = { width: 10, color: "#fff" };

  it("calculates row layout correctly", () => {
    const layout = calculateLayout(mockItems.slice(0, 2), "row", border);

    // Height should be max height of items (1000) + top margin (20) + bottom margin (30)
    expect(layout.height).toBe(1050);

    // Width should be item1 (1000) + gutter (10) + item2 (1000) + margins (2*20)
    expect(layout.width).toBe(2050);

    expect(layout.placements).toHaveLength(2);
    expect(layout.placements[0].y).toBe(20);
    expect(layout.placements[1].x).toBe(1030); // 20 + 1000 + 10
  });

  it("calculates column layout correctly", () => {
    const layout = calculateLayout(mockItems.slice(0, 2), "column", border);

    // Width should be max width (1000) + margins (2*20)
    expect(layout.width).toBe(1040);

    // Height should be item1 (1000) + gutter (10) + item2 (1000) + margins (20 + 30)
    expect(layout.height).toBe(2060);

    expect(layout.placements).toHaveLength(2);
    expect(layout.placements[0].x).toBe(20);
    expect(layout.placements[1].y).toBe(1030); // 20 + 1000 + 10
  });

  it("calculates grid-2x2 layout correctly", () => {
    const layout = calculateLayout(mockItems, "grid-2x2", border);

    // 2x2 grid of 1000x1000 items
    // Row 1 width: 2010 (1000+10+1000)
    // Row 2 width: 2010
    // Total width: 2050 (20 + 2010 + 20)
    expect(layout.width).toBe(2050);

    // Row 1 height: 1000
    // Row 2 height: 1000
    // Total height: 2060 (20 + 1000 + 10 + 1000 + 30)
    expect(layout.height).toBe(2060);

    expect(layout.placements).toHaveLength(4);
    // Item 3 (start of row 2)
    expect(layout.placements[2].x).toBe(20);
    expect(layout.placements[2].y).toBe(1030); // 20 + 1000 + 10
  });

  it("handles empty items gracefully", () => {
    const layout = calculateLayout([], "row", border);
    expect(layout.placements).toHaveLength(0);
    expect(layout.width).toBe(1000);
  });

  it("calculates grid-2x2 fallback for insufficient items", () => {
    const layout = calculateLayout(mockItems.slice(0, 3), "grid-2x2", border);
    expect(layout.placements).toHaveLength(0);
  });

  describe("Edge Cases", () => {
    it("handles landscape and portrait mixed", () => {
      const items = [
        { width: 1920, height: 1080 }, // landscape
        { width: 1080, height: 1920 }, // portrait
      ];
      const layout = calculateLayout(items, "row", border);

      expect(layout.placements).toHaveLength(2);
      // Heights should be normalized to max height (1920)
      expect(layout.placements[0].height).toBe(1920);
      expect(layout.placements[1].height).toBe(1920);
    });

    it("preserves crop data in placements", () => {
      const items = [{ width: 1000, height: 1000, crop: { x: 30, y: 40, scale: 1.5 } }];
      const layout = calculateLayout(items, "row", border);

      expect(layout.placements[0].crop).toEqual({ x: 30, y: 40, scale: 1.5 });
    });

    it("handles zero border width", () => {
      const items = [{ width: 1000, height: 1000 }];
      const layout = calculateLayout(items, "row", { width: 0, color: "#fff" });

      // No margins when border is 0
      expect(layout.width).toBe(1000);
      expect(layout.height).toBe(1000);
    });

    it("handles very small images", () => {
      const items = [
        { width: 50, height: 50 },
        { width: 50, height: 50 },
      ];
      const layout = calculateLayout(items, "row", border);

      expect(layout.placements).toHaveLength(2);
      expect(layout.width).toBeGreaterThan(0);
      expect(layout.height).toBeGreaterThan(0);
    });

    it("handles non-square aspect ratios in grid", () => {
      const items = [
        { width: 1920, height: 1080 },
        { width: 1920, height: 1080 },
        { width: 1080, height: 1920 },
        { width: 1080, height: 1920 },
      ];
      const layout = calculateLayout(items, "grid-2x2", border);

      expect(layout.placements).toHaveLength(4);
      // First row should have same height
      expect(layout.placements[0].height).toBe(layout.placements[1].height);
    });
  });
});

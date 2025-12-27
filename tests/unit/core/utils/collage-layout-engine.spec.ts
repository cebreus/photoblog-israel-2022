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

  const border: CollageBorder = { width: 10 };

  it("calculates row layout correctly", () => {
    const layout = calculateLayout(mockItems.slice(0, 2), "row", { border });

    // Height should be max height of items (1000) + top margin (10) + bottom margin (10)
    expect(layout.height).toBe(1020);

    // Width should be item1 (1000) + gutter (10) + item2 (1000) + margins (2*10)
    expect(layout.width).toBe(2030);

    expect(layout.placements).toHaveLength(2);
    expect(layout.placements[0].y).toBe(10);
    expect(layout.placements[1].x).toBe(1020); // 10 + 1000 + 10
  });

  it("calculates column layout correctly", () => {
    const layout = calculateLayout(mockItems.slice(0, 2), "column", { border });

    // Width should be max width (1000) + margins (2*10)
    expect(layout.width).toBe(1020);

    // Height should be item1 (1000) + gutter (10) + item2 (1000) + margins (2*10)
    expect(layout.height).toBe(2030);

    expect(layout.placements).toHaveLength(2);
    expect(layout.placements[0].x).toBe(10);
    expect(layout.placements[1].y).toBe(1020); // 10 + 1000 + 10
  });

  it("calculates grid-2x2 layout correctly", () => {
    const layout = calculateLayout(mockItems, "grid-2x2", { border });

    // 2x2 grid of 1000x1000 items
    // Row 1 width: 2010 (1000+10+1000)
    // Row 2 width: 2010
    // Total width: 2030 (10 + 2010 + 10)
    expect(layout.width).toBe(2030);

    // Row 1 height: 1000
    // Row 2 height: 1000
    // Total height: 2030 (10 + 1000 + 10 + 1000 + 10)
    expect(layout.height).toBe(2030);

    expect(layout.placements).toHaveLength(4);
    // Item 3 (start of row 2)
    expect(layout.placements[2].x).toBe(10);
    expect(layout.placements[2].y).toBe(1020); // 10 + 1000 + 10
  });

  it("handles empty items gracefully", () => {
    const layout = calculateLayout([], "row", { border });
    expect(layout.placements).toHaveLength(0);
    expect(layout.width).toBe(1000);
  });

  it("calculates grid-2x2 fallback for insufficient items", () => {
    const layout = calculateLayout(mockItems.slice(0, 3), "grid-2x2", { border });
    expect(layout.placements).toHaveLength(0);
  });

  describe("Edge Cases", () => {
    it("handles landscape and portrait mixed", () => {
      const items = [
        { width: 1920, height: 1080 }, // landscape
        { width: 1080, height: 1920 }, // portrait
      ];
      const layout = calculateLayout(items, "row", { border });

      expect(layout.placements).toHaveLength(2);
      // Heights should be normalized to max height (1920)
      expect(layout.placements[0].height).toBe(1920);
      expect(layout.placements[1].height).toBe(1920);
    });

    it("preserves crop data in placements", () => {
      const items = [{ width: 1000, height: 1000, crop: { x: 30, y: 40, scale: 1.5 } }];
      const layout = calculateLayout(items, "row", { border });

      expect(layout.placements[0].crop).toEqual({ x: 30, y: 40, scale: 1.5 });
    });

    it("handles zero border width", () => {
      const items = [{ width: 1000, height: 1000 }];
      const layout = calculateLayout(items, "row", { border: { width: 0 } });

      // No margins when border is 0
      expect(layout.width).toBe(1000);
      expect(layout.height).toBe(1000);
    });

    it("handles very small images", () => {
      const items = [
        { width: 50, height: 50 },
        { width: 50, height: 50 },
      ];
      const layout = calculateLayout(items, "row", { border });

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
      const layout = calculateLayout(items, "grid-2x2", { border });

      expect(layout.placements).toHaveLength(4);
      // First row should have same height
      expect(layout.placements[0].height).toBe(layout.placements[1].height);
    });
  });

  describe("New Layouts", () => {
    it("calculates hero-top layout correctly (3 items)", () => {
      const items = mockItems.slice(0, 3);
      const layout = calculateLayout(items, "hero-top", { border });

      expect(layout.placements).toHaveLength(3);
      // Item 0 is full width (hero)
      // Items 1, 2 are in row 2
      expect(layout.placements[0].y).toBe(10);
      expect(layout.placements[1].y).toBeGreaterThan(10);
      expect(layout.placements[1].y).toBe(layout.placements[2].y);
    });

    it("calculates hero-left layout correctly (3 items)", () => {
      const items = mockItems.slice(0, 3);
      const layout = calculateLayout(items, "hero-left", { border });

      expect(layout.placements).toHaveLength(3);
      // Item 0 is left column (full height target)
      expect(layout.placements[0].x).toBe(10);

      // Items 1, 2 are right column stack
      expect(layout.placements[1].x).toBeGreaterThan(layout.placements[0].width);
      expect(layout.placements[1].x).toBe(layout.placements[2].x);
      expect(layout.placements[2].y).toBeGreaterThan(layout.placements[1].y);
    });

    it("calculates hero-right layout correctly (3 items)", () => {
      const items = mockItems.slice(0, 3);
      const layout = calculateLayout(items, "hero-right", { border });

      expect(layout.placements).toHaveLength(3);
      // Implementation generates Left-to-Right: Stack (items 1, 2) then Hero (item 0)

      // placements[0] is Stack 1 (Left)
      expect(layout.placements[0].x).toBe(10);

      // placements[1] is Stack 2 (Left)
      expect(layout.placements[1].x).toBe(10);

      // placements[2] is Hero (Right)
      expect(layout.placements[2].x).toBeGreaterThan(layout.placements[0].width);
    });

    it("calculates density-7 layout correctly (7 items)", () => {
      // Need more items
      const sevenItems = [...mockItems, ...mockItems]; // 8 items
      const layout = calculateLayout(sevenItems.slice(0, 7), "density-7", { border });

      expect(layout.placements).toHaveLength(7);
      // R1: 2 items
      expect(layout.placements[0].y).toBe(10);
      expect(layout.placements[1].y).toBe(10);

      // R2: 3 items
      const r2y = layout.placements[2].y;
      expect(r2y).toBeGreaterThan(10);
      expect(layout.placements[3].y).toBe(r2y);
      expect(layout.placements[4].y).toBe(r2y);

      // R3: 2 items
      const r3y = layout.placements[5].y;
      expect(r3y).toBeGreaterThan(r2y);
      expect(layout.placements[6].y).toBe(r3y);
    });

    it("calculates grid-3x2 layout correctly (6 items)", () => {
      const sixItems = [...mockItems, ...mockItems].slice(0, 6);
      const layout = calculateLayout(sixItems, "grid-3x2", { border });

      expect(layout.placements).toHaveLength(6);
      // 3 rows of 2
      // R1
      expect(layout.placements[0].y).toBe(10);
      // R2
      expect(layout.placements[2].y).toBeGreaterThan(layout.placements[0].y);
      // R3
      expect(layout.placements[4].y).toBeGreaterThan(layout.placements[2].y);
    });

    it("calculates mosaic-6 layout correctly (6 items)", () => {
      const sixItems = [...mockItems, ...mockItems].slice(0, 6);
      const layout = calculateLayout(sixItems, "mosaic-6", { border });

      expect(layout.placements).toHaveLength(6);
      // Col 1: 0, 1
      expect(layout.placements[0].x).toBe(10);
      expect(layout.placements[1].x).toBe(10);

      // Col 2: 2, 3, 4
      expect(layout.placements[2].x).toBeGreaterThan(layout.placements[0].width);
      expect(layout.placements[3].x).toBe(layout.placements[2].x);

      // Col 3: 5
      expect(layout.placements[5].x).toBeGreaterThan(layout.placements[2].x);
    });

    it("calculates sidebar-hero layout correctly (4 items)", () => {
      const items = mockItems.slice(0, 4);
      const layout = calculateLayout(items, "sidebar-hero", { border });

      expect(layout.placements).toHaveLength(4);
      // Left: 0
      expect(layout.placements[0].x).toBe(10);

      // Right Top: 1, 2
      expect(layout.placements[1].x).toBeGreaterThan(layout.placements[0].width);
      expect(layout.placements[1].y).toBe(10);
      expect(layout.placements[2].y).toBe(10);

      // Right Bottom: 3
      expect(layout.placements[3].y).toBeGreaterThan(10);
      expect(layout.placements[3].x).toBe(layout.placements[1].x); // Starts same x as block
    });
  });
});

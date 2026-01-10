import { describe, expect, it } from "vitest";
import {
  calculateNormalizedBorderWidth,
  determineAutoTemplate,
  formatDimensionLabel,
  formatRatioLabel,
  parsePresetRatio,
} from "../../../../src/lib/utils/collage";
import { createMockImage } from "$tests/utils/gallery-test-utils";

describe("collage utilities", function () {
  describe("calculateNormalizedBorderWidth", function () {
    it("scales border based on image dimensions", function () {
      const images = [
        createMockImage({ width: 4000, height: 3000 }),
        createMockImage({ width: 4000, height: 3000 }),
      ];

      const normalized = calculateNormalizedBorderWidth(10, images);
      expect(normalized).toBeGreaterThan(10);
    });

    it("returns scaled value for small images", function () {
      const images = [createMockImage({ width: 800, height: 600 })];

      const normalized = calculateNormalizedBorderWidth(10, images);
      expect(normalized).toBeGreaterThan(0);
    });

    it("handles empty images array", function () {
      const normalized = calculateNormalizedBorderWidth(10, []);
      expect(normalized).toBe(10);
    });

    it("handles zero border width", function () {
      const images = [createMockImage({ width: 1000, height: 1000 })];
      const normalized = calculateNormalizedBorderWidth(0, images);
      expect(normalized).toBe(0);
    });
  });

  describe("determineAutoTemplate", function () {
    it("selects row for landscape images", function () {
      const images = [
        createMockImage({ width: 1920, height: 1080 }),
        createMockImage({ width: 1920, height: 1080 }),
      ];

      expect(determineAutoTemplate(images)).toBe("row");
    });

    it("selects column for portrait images", function () {
      const images = [
        createMockImage({ width: 1080, height: 1920 }),
        createMockImage({ width: 1080, height: 1920 }),
      ];

      expect(determineAutoTemplate(images)).toBe("column");
    });

    it("handles mixed orientations - uses majority", function () {
      const images = [
        createMockImage({ width: 1920, height: 1080 }), // landscape
        createMockImage({ width: 1080, height: 1920 }), // portrait
        createMockImage({ width: 1920, height: 1080 }), // landscape
      ];

      expect(determineAutoTemplate(images)).toBe("row");
    });

    it("defaults to row for square images", function () {
      const images = [
        createMockImage({ width: 1000, height: 1000 }),
        createMockImage({ width: 1000, height: 1000 }),
      ];

      expect(determineAutoTemplate(images)).toBe("row");
    });

    it("handles images without dimensions", function () {
      const images = [createMockImage({ width: undefined, height: undefined })];

      const result = determineAutoTemplate(images);
      expect(["row", "column"]).toContain(result);
    });
  });

  describe("formatRatioLabel", function () {
    it("formats 16:9 ratio", function () {
      const result = formatRatioLabel(1920, 1080);
      expect(result).toBe("16:9");
    });

    it("formats 4:3 ratio", function () {
      const result = formatRatioLabel(1600, 1200);
      expect(result).toBe("4:3");
    });

    it("formats 21:9 ratio", function () {
      const result = formatRatioLabel(2100, 900);
      // GCD of 2100 and 900 is 300, so 2100/300 : 900/300 = 7:3
      expect(result).toBe("7:3");
    });

    it("handles undefined dimensions", function () {
      const result = formatRatioLabel(undefined, undefined);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles zero dimensions", function () {
      const result = formatRatioLabel(0, 0);
      expect(result).toBeDefined();
    });
  });

  describe("formatDimensionLabel", function () {
    it("formats dimensions correctly", function () {
      const result = formatDimensionLabel(1920, 1080);
      expect(result).toContain("1920");
      expect(result).toContain("1080");
    });

    it("rounds decimal dimensions", function () {
      const result = formatDimensionLabel(1920.7, 1080.3);
      expect(result).toContain("1921");
      expect(result).toContain("1080");
    });

    it("handles undefined dimensions", function () {
      const result = formatDimensionLabel(undefined, undefined);
      expect(result).toBeDefined();
    });
  });

  describe("parsePresetRatio", function () {
    it("parses 16:9 ratio", function () {
      const ratio = parsePresetRatio("16:9");
      expect(ratio.width).toBe(16);
      expect(ratio.height).toBe(9);
    });

    it("parses 4:3 ratio", function () {
      const ratio = parsePresetRatio("4:3");
      expect(ratio.width).toBe(4);
      expect(ratio.height).toBe(3);
    });

    it("parses 21:9 ratio", function () {
      const ratio = parsePresetRatio("21:9");
      expect(ratio.width).toBe(21);
      expect(ratio.height).toBe(9);
    });
  });
});

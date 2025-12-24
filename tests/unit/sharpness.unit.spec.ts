/**
 * @fileoverview Sharpness Scoring Unit Tests
 *
 * @description
 * Tests the sharpness calculation algorithm (Laplacian variance).
 * Verifies that the score correlates with perceived image sharpness and
 * handles edge cases (blank images, noise).
 *
 * @modules-tested
 * - scripts/lib/sharpness.ts
 */

import { describe, expect, it } from "vitest";
import { normalizeSharpness } from "../../scripts/lib/image/utils";

describe("Sharpness Normalization", () => {
  it("should return 0 for non-positive variance", () => {
    expect(normalizeSharpness(0)).toBe(0);
    expect(normalizeSharpness(-10)).toBe(0);
  });

  it("should return a low score for low variance", () => {
    // underwater_blurry raw was ~194
    // sqrt(194) * 1.5 ~= 13.9 * 1.5 ~= 20.8
    const score = normalizeSharpness(194);
    expect(score).toBeGreaterThan(5);
    expect(score).toBeLessThan(10);
  });

  it("should return a high score for sharp images", () => {
    // people_documentary raw was ~7977
    // sqrt(7977) * 1.5 ~= 89 * 1.5 = 133.5 -> capped at 100
    const score = normalizeSharpness(7977);
    expect(score).toBe(100);

    // garden_overview raw was ~5780
    // sqrt(5780) * 1.5 ~= 76 * 1.5 = 114 -> capped at 100
    const score2 = normalizeSharpness(5780);
    expect(score2).toBe(100);

    // middle of the road
    // sqrt(2500) * 1.5 = 50 * 1.5 = 75
    expect(normalizeSharpness(2500)).toBe(75);
  });

  it("should cap at 100", () => {
    expect(normalizeSharpness(100000)).toBe(100);
  });
});

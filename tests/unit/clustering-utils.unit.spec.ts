/**
 * @fileoverview Clustering Utils Unit Tests
 *
 * @description
 * Tests centroid calculation and cluster merging utilities.
 */

import { describe, expect, it } from "vitest";
import {
  calculateCentroid,
  mergeClusters,
  updateCentroid,
} from "../../scripts/lib/clustering-utils";

describe("Centroid Calculation", () => {
  describe("calculateCentroid", () => {
    it("should return empty array for empty input", () => {
      const result = calculateCentroid([]);
      expect(result).toEqual([]);
    });

    it("should return copy of single descriptor", () => {
      const descriptor = [0.1, 0.2, 0.3];
      const result = calculateCentroid([descriptor]);
      expect(result).toEqual([0.1, 0.2, 0.3]);
      // Verify it's a copy, not the same reference
      expect(result).not.toBe(descriptor);
    });

    it("should calculate mean of two descriptors", () => {
      const desc1 = [0.0, 1.0, 2.0];
      const desc2 = [2.0, 3.0, 4.0];
      const result = calculateCentroid([desc1, desc2]);
      expect(result).toEqual([1.0, 2.0, 3.0]);
    });

    it("should calculate mean of multiple descriptors", () => {
      const descriptors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];
      const result = calculateCentroid(descriptors);
      expect(result[0]).toBeCloseTo(1 / 3);
      expect(result[1]).toBeCloseTo(1 / 3);
      expect(result[2]).toBeCloseTo(1 / 3);
    });
  });

  describe("updateCentroid", () => {
    it("should return copy of new descriptor when current is empty", () => {
      const result = updateCentroid([], 0, [1.0, 2.0, 3.0]);
      expect(result).toEqual([1.0, 2.0, 3.0]);
    });

    it("should calculate running average correctly", () => {
      // Current: [2.0, 4.0] with count 1
      // New: [4.0, 8.0]
      // Expected: (2*1 + 4) / 2 = 3, (4*1 + 8) / 2 = 6
      const result = updateCentroid([2.0, 4.0], 1, [4.0, 8.0]);
      expect(result).toEqual([3.0, 6.0]);
    });

    it("should weight existing centroid by count", () => {
      // Current: [1.0, 1.0] with count 3
      // New: [5.0, 5.0]
      // Expected: (1*3 + 5) / 4 = 2, (1*3 + 5) / 4 = 2
      const result = updateCentroid([1.0, 1.0], 3, [5.0, 5.0]);
      expect(result).toEqual([2.0, 2.0]);
    });
  });

  describe("mergeClusters", () => {
    it("should return empty for no clusters", () => {
      const result = mergeClusters([]);
      expect(result).toEqual({ centroid: [], faceCount: 0 });
    });

    it("should return copy for single cluster", () => {
      const cluster = { centroid: [1.0, 2.0, 3.0], faceCount: 5 };
      const result = mergeClusters([cluster]);
      expect(result.centroid).toEqual([1.0, 2.0, 3.0]);
      expect(result.faceCount).toBe(5);
      // Verify it's a copy
      expect(result.centroid).not.toBe(cluster.centroid);
    });

    it("should merge two equal-weight clusters", () => {
      const clusters = [
        { centroid: [0.0, 0.0], faceCount: 1 },
        { centroid: [2.0, 4.0], faceCount: 1 },
      ];
      const result = mergeClusters(clusters);
      expect(result.centroid).toEqual([1.0, 2.0]);
      expect(result.faceCount).toBe(2);
    });

    it("should weight centroids by faceCount", () => {
      // Cluster A: [0, 0] with 3 faces (75% weight)
      // Cluster B: [4, 8] with 1 face (25% weight)
      // Expected: [0*0.75 + 4*0.25, 0*0.75 + 8*0.25] = [1, 2]
      const clusters = [
        { centroid: [0.0, 0.0], faceCount: 3 },
        { centroid: [4.0, 8.0], faceCount: 1 },
      ];
      const result = mergeClusters(clusters);
      expect(result.centroid).toEqual([1.0, 2.0]);
      expect(result.faceCount).toBe(4);
    });

    it("should handle clusters with zero total faceCount", () => {
      const clusters = [
        { centroid: [1.0, 2.0], faceCount: 0 },
        { centroid: [3.0, 4.0], faceCount: 0 },
      ];
      const result = mergeClusters(clusters);
      expect(result).toEqual({ centroid: [], faceCount: 0 });
    });

    it("should merge three clusters correctly", () => {
      // A: [3, 0, 0] with 2 faces
      // B: [0, 3, 0] with 2 faces
      // C: [0, 0, 3] with 2 faces
      // Each has 1/3 weight, so result = [1, 1, 1]
      const clusters = [
        { centroid: [3.0, 0.0, 0.0], faceCount: 2 },
        { centroid: [0.0, 3.0, 0.0], faceCount: 2 },
        { centroid: [0.0, 0.0, 3.0], faceCount: 2 },
      ];
      const result = mergeClusters(clusters);
      expect(result.centroid[0]).toBeCloseTo(1.0);
      expect(result.centroid[1]).toBeCloseTo(1.0);
      expect(result.centroid[2]).toBeCloseTo(1.0);
      expect(result.faceCount).toBe(6);
    });
  });
});

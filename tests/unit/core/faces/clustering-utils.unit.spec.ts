/**
 * @fileoverview Clustering Utilities Unit Tests
 *
 * @description
 * Tests helper functions used in the face clustering pipeline.
 * Covers:
 * - Euclidean distance calculations (delegating to face-api)
 * - Person distance aggregation and best match finding
 * - Constrain checks (disconnected pairs)
 * - Centroid calculation and cluster merging utilities
 *
 * @modules-tested
 * - scripts/lib/faces/clustering.ts
 */

import * as faceapi from "@vladmandic/face-api";
import { describe, expect, it, vi } from "vitest";
import type { Person } from "$lib/types/manifest";
import {
  calculateCentroid,
  calculatePersonDistance,
  euclideanDistance,
  findBestMatch,
  isConstrainedPair,
  mergeClusters,
  updateCentroid,
} from "../../../../scripts/lib/faces/clustering";

// Mock face-api
vi.mock("@vladmandic/face-api/dist/face-api.node.js", () => ({
  euclideanDistance: vi.fn((a, b) => {
    // Simple mock implementation: diff of first elements
    return Math.abs(a[0] - b[0]);
  }),
}));

describe("clustering-utils", () => {
  // ==========================================================================
  // Distance Calculations
  // ==========================================================================
  describe("euclideanDistance", () => {
    it("should delegate to face-api", () => {
      const d1 = [1, 2];
      const d2 = [4, 5];
      vi.mocked(faceapi.euclideanDistance).mockReturnValue(0.5);
      expect(euclideanDistance(d1, d2)).toBe(0.5);
      expect(faceapi.euclideanDistance).toHaveBeenCalledWith(d1, d2);
    });
  });

  describe("calculatePersonDistance", () => {
    it("should return 1.0 if person has no descriptor or clusters", () => {
      const person = { faceDescriptor: [], clusters: [] } as unknown as Person;
      expect(calculatePersonDistance([1], person)).toBe(1.0);
    });

    it("should return min distance to any cluster", () => {
      const person = {
        clusters: [{ centroid: [0] }, { centroid: [1] }],
      } as unknown as Person;

      vi.mocked(faceapi.euclideanDistance).mockImplementation(
        (a: number[] | Float32Array, b: number[] | Float32Array) =>
          Math.abs((a as number[])[0] - (b as number[])[0]),
      );

      expect(calculatePersonDistance([1], person)).toBe(0);
      expect(calculatePersonDistance([0], person)).toBe(0);
      expect(calculatePersonDistance([10], person)).toBe(9);
    });

    it("should fallback to legacy faceDescriptor if clusters missing", () => {
      const person = {
        faceDescriptor: [5],
        clusters: [],
      } as unknown as Person;

      vi.mocked(faceapi.euclideanDistance).mockImplementation(
        (a: number[] | Float32Array, b: number[] | Float32Array) =>
          Math.abs((a as number[])[0] - (b as number[])[0]),
      );

      expect(calculatePersonDistance([1], person)).toBe(4);
    });

    it("should apply temporal penalty when years differ", () => {
      const person = {
        clusters: [{ centroid: [0], year: 2020 }],
      } as unknown as Person;

      vi.mocked(faceapi.euclideanDistance).mockImplementation(
        () => 0.1, // Base distance
      );

      // Same year = no penalty
      expect(calculatePersonDistance([0], person, 2020)).toBe(0.1);

      // 1 year diff = +0.02
      expect(calculatePersonDistance([0], person, 2021)).toBeCloseTo(0.12);

      // 5 years diff = +0.08 (capped)
      expect(calculatePersonDistance([0], person, 2025)).toBeCloseTo(0.18);
    });

    it("should apply category bonus for statues and paintings", () => {
      const personStatue = {
        clusters: [{ centroid: [0] }],
        category: "statue",
      } as unknown as Person;

      const personPainting = {
        clusters: [{ centroid: [0] }],
        category: "painting",
      } as unknown as Person;

      const personHuman = {
        clusters: [{ centroid: [0] }],
        category: "person",
      } as unknown as Person;

      vi.mocked(faceapi.euclideanDistance).mockImplementation(
        () => 0.5, // Base distance
      );

      // Statue should have bonus (0.5 - 0.05 = 0.45)
      expect(calculatePersonDistance([0], personStatue)).toBeCloseTo(0.45);

      // Painting should have bonus
      expect(calculatePersonDistance([0], personPainting)).toBeCloseTo(0.45);

      // Human should be standard
      expect(calculatePersonDistance([0], personHuman)).toBe(0.5);
    });
  });

  // ==========================================================================
  // Constraints
  // ==========================================================================
  describe("isConstrainedPair", () => {
    it("should return true if pair is in disconnected set", () => {
      const disconnected = new Set<string>(["a:b"]);
      expect(isConstrainedPair(disconnected, "a", "b")).toBe(true);
    });

    it("should return false if pair is not constrained", () => {
      const disconnected = new Set<string>();
      expect(isConstrainedPair(disconnected, "a", "b")).toBe(false);
    });
  });

  // ==========================================================================
  // Best Match Finding
  // ==========================================================================
  describe("findBestMatch", () => {
    it("should return best match even if person is ignored", () => {
      const ignoredPerson = {
        id: "ignored-1",
        name: "Ignored Person",
        ignored: true,
        clusters: [{ centroid: [1.1] }],
      } as unknown as Person;

      const visiblePerson = {
        id: "visible-1",
        name: "Visible Person",
        ignored: false,
        clusters: [{ centroid: [2.0] }],
      } as unknown as Person;

      const people = [ignoredPerson, visiblePerson];
      const constraints = new Set<string>();
      const threshold = 0.5;

      // Ensure proper mock return values for specific descriptors
      vi.mocked(faceapi.euclideanDistance).mockImplementation(
        (a: number[] | Float32Array, b: number[] | Float32Array) => {
          // ignoredPerson ([1.1] vs [1.0]) -> 0.1
          if ((a as number[])[0] === 1.0 && (b as number[])[0] === 1.1) return 0.1;
          // visiblePerson ([2.0] vs [1.0]) -> 1.0
          if ((a as number[])[0] === 1.0 && (b as number[])[0] === 2.0) return 1.0;
          return 100;
        },
      );

      const match = findBestMatch([1.0], people, constraints, "img1", threshold);
      expect(match?.id).toBe("ignored-1");
    });

    it("should return null if best match is constrained", () => {
      const person = {
        id: "p1",
        clusters: [{ centroid: [1.1] }],
      } as unknown as Person;

      const people = [person];
      const constraints = new Set<string>(["img1:p1"]);
      const threshold = 0.5;

      const match = findBestMatch([1.0], people, constraints, "img1", threshold);
      expect(match).toBeNull();
    });
  });

  // ==========================================================================
  // Centroid Calculation
  // ==========================================================================
  describe("calculateCentroid", () => {
    it("should return empty array for empty input", () => {
      const result = calculateCentroid([]);
      expect(result).toEqual([]);
    });

    it("should return copy of single descriptor", () => {
      const descriptor = [0.1, 0.2, 0.3];
      const result = calculateCentroid([descriptor]);
      expect(result).toEqual([0.1, 0.2, 0.3]);
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
      const result = updateCentroid([2.0, 4.0], 1, [4.0, 8.0]);
      expect(result).toEqual([3.0, 6.0]);
    });

    it("should weight existing centroid by count", () => {
      const result = updateCentroid([1.0, 1.0], 3, [5.0, 5.0]);
      expect(result).toEqual([2.0, 2.0]);
    });
  });

  // ==========================================================================
  // Cluster Merging
  // ==========================================================================
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

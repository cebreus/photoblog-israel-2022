/**
 * @fileoverview Clustering Utilities Unit Tests
 *
 * @description
 * Tests helper functions used in the face clustering pipeline.
 * Covers Euclidean distance calculations (delegating to face-api mock),
 * person distance aggregation, and constrain checks (disconnected pairs).
 *
 * @modules-tested
 * - scripts/lib/clustering-utils.ts
 */

import * as faceapi from "@vladmandic/face-api";
import { describe, expect, it, vi } from "vitest";
import type { Person } from "$lib/types/manifest";
import {
  calculatePersonDistance,
  euclideanDistance,
  isConstrainedPair,
} from "../../scripts/lib/clustering-utils";

// Mock face-api
vi.mock("@vladmandic/face-api", () => ({
  euclideanDistance: vi.fn((a, b) => {
    // Simple mock implementation: diff of first elements
    return Math.abs(a[0] - b[0]);
  }),
}));

describe("clustering-utils", () => {
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
    it("should return Infinity if person has no descriptor or clusters", () => {
      const person = { faceDescriptor: [], clusters: [] } as unknown as Person;
      expect(calculatePersonDistance([1], person)).toBe(1.0);
    });

    it("should return min distance to any cluster", () => {
      // Cluster A: [0] (dist to [1] is 1)
      // Cluster B: [1] (dist to [1] is 0)
      const person = {
        clusters: [{ centroid: [0] }, { centroid: [1] }],
      } as unknown as Person;

      vi.mocked(faceapi.euclideanDistance).mockImplementation((a: any, b: any) =>
        Math.abs(a[0] - b[0]),
      );

      // Should pick Cluster B (dist 0)
      expect(calculatePersonDistance([1], person)).toBe(0);
      // Should pick Cluster A (dist 1) vs Cluster B (dist 2) -> 1
      expect(calculatePersonDistance([0], person)).toBe(0); // dist([0],[0])=0
      expect(calculatePersonDistance([10], person)).toBe(9); // dist([10],[1])=9
    });

    it("should fallback to legacy faceDescriptor if clusters missing", () => {
      const person = {
        faceDescriptor: [5],
        clusters: [],
      } as unknown as Person;

      vi.mocked(faceapi.euclideanDistance).mockImplementation((a: any, b: any) =>
        Math.abs(a[0] - b[0]),
      );

      // dist([1],[5]) = 4
      expect(calculatePersonDistance([1], person)).toBe(4);
    });
  });

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
});

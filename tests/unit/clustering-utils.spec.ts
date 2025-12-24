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
  findBestMatch,
  isConstrainedPair,
} from "../../scripts/lib/clustering-utils";

// Mock face-api
vi.mock("@vladmandic/face-api/dist/face-api.node.js", () => ({
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
    it("should return 1.0 if person has no descriptor or clusters", () => {
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

      // Target [1.0] is closer to ignored [1.1] (dist 0.1) than visible [2.0] (dist 1.0)
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
});

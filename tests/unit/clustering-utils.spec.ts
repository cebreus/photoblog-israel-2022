import * as faceapi from "@vladmandic/face-api";
import { describe, expect, it, vi } from "vitest";
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
      (faceapi.euclideanDistance as any).mockReturnValue(0.5);
      expect(euclideanDistance(d1, d2)).toBe(0.5);
      expect(faceapi.euclideanDistance).toHaveBeenCalledWith(d1, d2);
    });
  });

  describe("calculatePersonDistance", () => {
    it("should return Infinity if person has no descriptor", () => {
      const person: any = { faceDescriptors: [] };
      expect(calculatePersonDistance([1], person)).toBe(1.0);
    });

    it("should return average distance to descriptors", () => {
      const person: any = { faceDescriptors: [[0], [2]] }; // Avg 1
      // Target [0]
      // dist([0], [0]) = 0
      // dist([0], [2]) = 2 (mock implementation abs diff)
      // avg = 1
      (faceapi.euclideanDistance as any).mockImplementation((a: any, b: any) =>
        Math.abs(a[0] - b[0]),
      );

      expect(calculatePersonDistance([0], person)).toBe(1);
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

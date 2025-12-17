import { describe, it, expect } from "vitest";
import { getVisiblePeople } from "$lib/utils/people";
import type { Person } from "$lib/types/manifest";

describe("getVisiblePeople", () => {
  it("should filter out ignored people", () => {
    const people = [
      { id: "1", name: "P1", faceCount: 5, ignored: false },
      { id: "2", name: "P2", faceCount: 5, ignored: true },
    ] as Person[];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter out people with 0 photos", () => {
    const people = [
      { id: "1", name: "P1", faceCount: 5, ignored: false },
      { id: "2", name: "P2", faceCount: 0, ignored: false },
    ] as Person[];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should sort by faceCount descending", () => {
    const people = [
      { id: "1", name: "P1", faceCount: 2, ignored: false },
      { id: "2", name: "P2", faceCount: 10, ignored: false },
      { id: "3", name: "P3", faceCount: 5, ignored: false },
    ] as Person[];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual(["2", "3", "1"]);
  });

  it("should handle mixed conditions", () => {
    const people = [
      { id: "1", name: "P1", faceCount: 2, ignored: true }, // ignored
      { id: "2", name: "P2", faceCount: 0, ignored: false }, // empty
      { id: "3", name: "P3", faceCount: 5, ignored: false }, // ok
    ] as Person[];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });
});

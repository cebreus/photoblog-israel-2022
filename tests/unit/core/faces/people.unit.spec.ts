/**
 * @fileoverview People Entity Unit Tests
 *
 * @description
 * Tests the logic related to Person entities.
 * Verifies data structure integrity, name formatting, and relationship management
 * for detected people in the gallery.
 *
 * @modules-tested
 * - scripts/lib/people.ts
 */

import { describe, expect, it } from "vitest";
import { getVisiblePeople } from "$lib/utils/people";
import { createMockPerson } from "../../../fixtures/people";

describe("getVisiblePeople", () => {
  it("should filter out ignored people", () => {
    const people = [
      createMockPerson({ id: "1", name: "P1", faceCount: 5 }),
      createMockPerson({ id: "2", name: "P2", faceCount: 5, junk: true, hidden: true }),
    ];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter out people with 0 photos", () => {
    const people = [
      createMockPerson({ id: "1", name: "P1", faceCount: 5 }),
      createMockPerson({ id: "2", name: "P2", faceCount: 0 }),
    ];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should sort by faceCount descending", () => {
    const people = [
      createMockPerson({ id: "person-1", name: "P1", faceCount: 2 }),
      createMockPerson({ id: "person-2", name: "P2", faceCount: 10 }),
      createMockPerson({ id: "person-3", name: "P3", faceCount: 5 }),
    ];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual(["person-2", "person-3", "person-1"]);
  });

  it("should handle mixed conditions", () => {
    const people = [
      createMockPerson({ id: "1", name: "P1", faceCount: 2, junk: true, hidden: true }), // junk
      createMockPerson({ id: "2", name: "P2", faceCount: 0 }), // empty
      createMockPerson({ id: "3", name: "P3", faceCount: 5 }), // ok
    ];

    const result = getVisiblePeople(people);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("should sort named people before generic people", () => {
    const people = [
      createMockPerson({ id: "person-1", name: "Generic-High", faceCount: 100 }),
      createMockPerson({ id: "person-2--named", name: "Named-Low", faceCount: 2 }),
    ];

    const result = getVisiblePeople(people);
    // Named-Low (2 faces) should be BEFORE Generic-High (100 faces)
    expect(result[0].id).toBe("person-2--named");
    expect(result[1].id).toBe("person-1");
  });

  it("should sort named people alphabetically (Czech locale)", () => {
    const people = [
      createMockPerson({ id: "p2--cert", name: "Čert", faceCount: 5 }),
      createMockPerson({ id: "p1--adam", name: "Adam", faceCount: 5 }),
      createMockPerson({ id: "p3--dasa", name: "Dáša", faceCount: 5 }),
    ];

    const result = getVisiblePeople(people);
    expect(result.map((p) => p.name)).toEqual(["Adam", "Čert", "Dáša"]);
  });

  it("should sort generic people by faceCount descending", () => {
    const people = [
      createMockPerson({ id: "person-1", name: "P1", faceCount: 10 }),
      createMockPerson({ id: "person-2", name: "P2", faceCount: 50 }),
    ];

    const result = getVisiblePeople(people);
    expect(result[0].id).toBe("person-2");
    expect(result[1].id).toBe("person-1");
  });
});

import { enrichPeopleWithStats } from "$lib/utils/people";

describe("enrichPeopleWithStats", () => {
  const mockPeople = [
    createMockPerson({ id: "p1", name: "Alice", faceCount: 0 }),
    createMockPerson({ id: "p2", name: "Bob", faceCount: 0 }),
    createMockPerson({ id: "p3", name: "Charlie", faceCount: 0 }),
  ];

  const mockPhotoDays = [
    {
      items: [
        { type: "image", id: "img1", people: ["p1", "p2"] },
        { type: "image", id: "img2", people: ["p1"] },
        { type: "separator", id: "sep1" }, // Should be ignored
        { type: "image", id: "img3", people: [] }, // No people
      ],
    },
    {
      items: [{ type: "image", id: "img4", people: ["p1", "p3"] }],
    },
  ] as any[];

  it("should correctly count faces across multiple days and images", () => {
    const result = enrichPeopleWithStats(mockPeople, mockPhotoDays);

    const alice = result.find((p) => p.id === "p1");
    const bob = result.find((p) => p.id === "p2");
    const charlie = result.find((p) => p.id === "p3");

    // Alice: img1, img2, img4 = 3
    expect(alice?.faceCount).toBe(3);
    // Bob: img1 = 1
    expect(bob?.faceCount).toBe(1);
    // Charlie: img4 = 1
    expect(charlie?.faceCount).toBe(1);
  });

  it("should return 0 for people not found in any images (p4)", () => {
    const people = [...mockPeople, createMockPerson({ id: "p4", name: "Dave", faceCount: 0 })];
    const result = enrichPeopleWithStats(people, mockPhotoDays);
    const dave = result.find((p) => p.id === "p4");
    expect(dave?.faceCount).toBe(0);
  });

  it("should be immutable and return new objects", () => {
    const output = enrichPeopleWithStats(mockPeople, mockPhotoDays);
    expect(output).not.toBe(mockPeople);
    expect(output[0]).not.toBe(mockPeople[0]);
    // Inputs should remain unchanged
    expect(mockPeople[0].faceCount).toBe(0);
  });
});

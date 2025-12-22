import type { Person, PhotoDay } from "$lib/types/manifest";

function isVisiblePerson(person: Person): boolean {
  return !person.ignored && person.faceCount > 0;
}

function compareByNameThenFaceCount(a: Person, b: Person): number {
  // 1. Sort Named vs Generic
  // Generic IDs: "person-<uuid>" (where UUID is an 8-char random string)
  // Renamed IDs: "person-<uuid>--<slug>"
  //
  // LOGIC:
  // - A "Generic" person is one whose ID starts with "person-" AND does NOT contain "--".
  // - A "Named" person is anyone else (legacy IDs or IDs with "--" suffix).
  //
  // This distinction is crucial for separating "unknown" people from "identified" people
  // in the UI, ensuring that users see their identified friends/family first.

  const isGeneric = (p: Person) => p.id.startsWith("person-") && !p.id.includes("--");

  const aIsGeneric = isGeneric(a);
  const bIsGeneric = isGeneric(b);

  // Named (Custom) come first
  if (!aIsGeneric && bIsGeneric) return -1;
  if (aIsGeneric && !bIsGeneric) return 1;

  if (!aIsGeneric && !bIsGeneric) {
    // Both named: Sort by Name (A-Z)
    return a.name.localeCompare(b.name, "cs", { sensitivity: "base" });
  }

  // Both Generic: Sort by Face Count (Descending)
  return b.faceCount - a.faceCount;
}

export function getVisiblePeople(people: Person[]): Person[] {
  return [...people].filter(isVisiblePerson).sort(compareByNameThenFaceCount);
}

function enrichPersonWithFaceCount(faceCounts: Map<string, number>) {
  return function updatePersonFaceCount(person: Person): Person {
    return {
      ...person,
      faceCount: faceCounts.get(person.id) ?? 0,
    };
  };
}

export function enrichPeopleWithStats(people: Person[], photoDays: PhotoDay[]): Person[] {
  const faceCounts = new Map<string, number>();
  for (const person of people) {
    faceCounts.set(person.id, 0);
  }

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.people) {
        for (const personId of item.people) {
          const current = faceCounts.get(personId);
          if (current !== undefined) {
            faceCounts.set(personId, current + 1);
          }
        }
      }
    }
  }

  return people.map(enrichPersonWithFaceCount(faceCounts));
}

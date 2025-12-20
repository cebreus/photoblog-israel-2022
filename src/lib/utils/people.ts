import type { Person, PhotoDay } from "$lib/types/manifest";

function isVisiblePerson(person: Person): boolean {
  return !person.ignored && person.faceCount > 0;
}

function compareByNameThenFaceCount(a: Person, b: Person): number {
  // 1. Sort Named vs Generic
  // Generic IDs are basically "person-<uuid>" (where UUID is 8-char hex in face-clustering)
  // Renamed IDs are "person-<uuid>--<slug>"
  // We consider "Generic" anyone whose ID starts with "person-" but does NOT contain "--"
  // This robustly handles the system's ID generation logic.

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

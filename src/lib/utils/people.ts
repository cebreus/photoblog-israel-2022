import { isImageEntry, type Person, type PhotoDay } from "$lib/types/manifest";
import { isGloballyVisible } from "./gallery";

function isVisiblePerson(person: Person): boolean {
  return !person.hidden && !person.junk && person.faceCount > 0;
}

function compareByNameThenFaceCount(a: Person, b: Person): number {
  // 1. Sort Named vs Generic
  // Generic persons have names like "Person 26" or "Odpojeno od..."
  // Named persons have custom names like "Dáša", "Jaruška", etc.
  //
  // LOGIC:
  // - A "Generic" person is one whose name matches "Person \d+" or contains "odpojeno od".
  // - A "Named" person is anyone else (has a custom name).
  //
  // This distinction is crucial for separating "unknown" people from "identified" people
  // in the UI, ensuring that users see their identified friends/family first.

  const isGeneric = (p: Person) => {
    if (p.isUserNamed !== undefined) return !p.isUserNamed;
    return p.name.match(/^Person \d+$/) || p.name.toLowerCase().includes("odpojeno od");
  };

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

function enrichPersonWithStats(
  faceCounts: Map<string, number>,
  detectionsCounts: Map<string, number>,
) {
  return function updatePersonStats(person: Person): Person {
    return {
      ...person,
      faceCount: faceCounts.get(person.id) ?? 0,
      detectionsCount: detectionsCounts.get(person.id) ?? 0,
    };
  };
}

export function enrichPeopleWithStats(people: Person[], photoDays: PhotoDay[]): Person[] {
  const faceCounts = new Map<string, number>();
  const detectionsCounts = new Map<string, number>();

  for (const person of people) {
    faceCounts.set(person.id, 0);
    detectionsCounts.set(person.id, 0);
  }

  for (const day of photoDays) {
    for (const item of day.items) {
      if (isGloballyVisible(item) && isImageEntry(item) && item.people) {
        // Add each person present in the image to faceCounts (one per image)
        const uniquePeopleInImage = new Set(item.people);
        for (const personId of uniquePeopleInImage) {
          const current = faceCounts.get(personId);
          if (current !== undefined) {
            faceCounts.set(personId, current + 1);
          }
        }

        // Add all occurrences to detectionsCounts
        for (const personId of item.people) {
          const current = detectionsCounts.get(personId);
          if (current !== undefined) {
            detectionsCounts.set(personId, current + 1);
          }
        }
      }
    }
  }

  return people.map(enrichPersonWithStats(faceCounts, detectionsCounts));
}

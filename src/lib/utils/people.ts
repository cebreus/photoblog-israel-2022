import type { Person, PhotoDay } from "$lib/types/manifest";

function isVisiblePerson(person: Person): boolean {
  return !person.ignored && person.faceCount > 0;
}

function compareByNameThenFaceCount(a: Person, b: Person): number {
  if (b.faceCount !== a.faceCount) {
    return b.faceCount - a.faceCount;
  }
  return a.name.localeCompare(b.name, "cs", { sensitivity: "base" });
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

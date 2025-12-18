import type { Person, PhotoDay } from "$lib/types/manifest";

/**
 * Filters and sorts people for display in the UI.
 * - Hides ignored people
 * - Hides people with 0 photos (empty profiles after merge)
 * - Sorts by face count descending
 */
export function getVisiblePeople(people: Person[]): Person[] {
  return [...people]
    .filter((p) => !p.ignored && p.faceCount > 0)
    .sort((a, b) => {
      // Sort primarily by alphabetical name order
      const nameCompare = a.name.localeCompare(b.name, "cs", { sensitivity: "base" });
      if (nameCompare !== 0) return nameCompare;
      // Secondary sort by face count (descending)
      return b.faceCount - a.faceCount;
    });
}
/**
 * Efficiently computes face counts for all people in a single pass through the photo days.
 * Returns a new array of people with updated faceCount properties.
 */
export function enrichPeopleWithStats(people: Person[], photoDays: PhotoDay[]): Person[] {
  // Initialize counts map
  const faceCounts = new Map<string, number>();
  for (const person of people) {
    faceCounts.set(person.id, 0);
  }

  // Single pass counting (O(M), where M is number of photos)
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

  // Update people objects (O(N), where N is number of people)
  return people.map((p) => ({
    ...p,
    faceCount: faceCounts.get(p.id) ?? 0,
  }));
}

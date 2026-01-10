import path from "node:path";
import {
  isImageEntry,
  type Manifest,
  type PeopleManifest,
  type Person,
} from "../../../src/lib/types/manifest";
import { readdir } from "$scripts/utils/runtime";

/**
 * Recalculates the faceCount for a specific person based on the images manifest.
 * This is the authoritative source of truth for face counts.
 */
export function recalculateFaceCount(personId: string, imagesManifest: Manifest): number {
  let count = 0;
  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (isImageEntry(item) && item.people?.includes(personId)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Recalculates faceCount for ALL people in the manifest.
 * Use this after bulk operations or when consistency is suspected to be broken.
 */
export function recalculateAllFaceCounts(
  peopleManifest: PeopleManifest,
  imagesManifest: Manifest,
): void {
  // Build a map for efficiency
  const counts = new Map<string, number>();
  for (const person of peopleManifest.people) {
    counts.set(person.id, 0);
  }

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (isImageEntry(item) && item.people) {
        for (const personId of item.people) {
          const current = counts.get(personId);
          if (current !== undefined) {
            counts.set(personId, current + 1);
          }
        }
      }
    }
  }

  // Apply counts
  for (const person of peopleManifest.people) {
    person.faceCount = counts.get(person.id) ?? 0;
  }
}

/**
 * Finds an available thumbnail for a person by scanning their face directory.
 * Returns empty string if no valid thumbnails exist.
 */
export async function findAvailableThumbnail(personId: string, facesDir: string): Promise<string> {
  const personDir = path.resolve(facesDir, personId);
  try {
    const files = await readdir(personDir);
    const valid = (files as string[]).filter((f) => f.endsWith(".jpg") && !f.startsWith("."));
    if (valid.length > 0) {
      return `faces/${personId}/${valid[0]}`;
    }
  } catch (_e) {
    // Directory doesn't exist or is empty
  }
  return "";
}

/**
 * Removes empty person entries (faceCount === 0) from the manifest.
 * Returns the number of removed entries.
 */
export function removeEmptyPeople(peopleManifest: PeopleManifest): number {
  const before = peopleManifest.people.length;
  peopleManifest.people = peopleManifest.people.filter((p: Person) => p.faceCount > 0);
  return before - peopleManifest.people.length;
}

/**
 * Checks if a person should be visible in the main UI lists.
 */
export function isPersonVisible(person: Person): boolean {
  return !person.hidden && !person.junk && person.faceCount > 0;
}

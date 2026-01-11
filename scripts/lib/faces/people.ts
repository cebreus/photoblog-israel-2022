/**
 * @fileoverview People & Person Utilities
 *
 * Consolidated utilities for person management, face descriptors,
 * reference updates, and consistency checks.
 *
 * Merged from: people-utils.ts, person-utils.ts, people-consistency.ts
 */

import { fileExists, isJpegPath, readdir } from "$scripts/utils/runtime";
import {
  type FacesManifest,
  isImageEntry,
  type Manifest,
  type PeopleManifest,
  type Person,
} from "$shared/types/manifest";
import path from "node:path";

// ============================================
// From person-utils.ts: Reference Updates
// ============================================

/**
 * Updates all references from oldPersonId to newPersonId in images and faces manifests.
 * Returns the count of updated images.
 */
export function updatePersonReferences(
  imagesManifest: Manifest,
  facesManifest: FacesManifest,
  oldPersonId: string,
  newPersonId: string,
): number {
  let updatedCount = 0;

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item)) continue;
      if (!item.people?.includes(oldPersonId)) continue;

      // Update images manifest
      item.people = item.people.map((id) => (id === oldPersonId ? newPersonId : id));
      item.people = [...new Set(item.people)]; // Dedupe
      updatedCount++;

      // Sync faces manifest
      const faceData = facesManifest[item.id];
      if (faceData?.peopleIds?.includes(oldPersonId)) {
        faceData.peopleIds = faceData.peopleIds.map((id) =>
          id === oldPersonId ? newPersonId : id,
        );
        faceData.peopleIds = [...new Set(faceData.peopleIds)];
      }
    }
  }

  return updatedCount;
}

/**
 * Updates references for a specific image only.
 * Used when reassigning specific faces rather than all faces of a person.
 */
export function updateImagePersonReference(
  imagesManifest: Manifest,
  facesManifest: FacesManifest,
  imageId: string,
  oldPersonId: string,
  newPersonId: string,
): boolean {
  let updated = false;

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item) || item.id !== imageId) continue;
      if (!item.people?.includes(oldPersonId)) continue;

      item.people = item.people.map((id) => (id === oldPersonId ? newPersonId : id));
      item.people = [...new Set(item.people)];
      updated = true;
    }
  }

  if (facesManifest[imageId]) {
    const faceData = facesManifest[imageId];
    if (faceData.peopleIds?.includes(oldPersonId)) {
      faceData.peopleIds = faceData.peopleIds.map((id) => (id === oldPersonId ? newPersonId : id));
      faceData.peopleIds = [...new Set(faceData.peopleIds)];
      updated = true;
    }
  }

  return updated;
}

/**
 * Removes a person from a specific image's references.
 * Used by unmatch and invalidate-detection.
 */
export function removePersonFromImage(
  imagesManifest: Manifest,
  facesManifest: FacesManifest,
  imageId: string,
  personId: string,
): boolean {
  let removed = false;

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item) || item.id !== imageId) continue;
      if (!item.people?.includes(personId)) continue;

      item.people = item.people.filter((id) => id !== personId);
      removed = true;
    }
  }

  if (facesManifest[imageId]?.peopleIds?.includes(personId)) {
    // Robust cleanup: splice all parallel arrays to maintain alignment
    const faceEntry = facesManifest[imageId];
    if (faceEntry.peopleIds) {
      for (let i = faceEntry.peopleIds.length - 1; i >= 0; i--) {
        if (faceEntry.peopleIds[i] === personId) {
          faceEntry.peopleIds.splice(i, 1);
          if (faceEntry.faces) faceEntry.faces.splice(i, 1);
          if (faceEntry.descriptors) faceEntry.descriptors.splice(i, 1);
          removed = true;
        }
      }
    }
  }

  return removed;
}

// ============================================
// From people-consistency.ts: Consistency & Cleanup
// ============================================

/**
 * Recalculates the faceCount for a specific person based on the images manifest.
 * This is the authoritative source of truth for face counts.
 */
export function recalculateFaceCount(personId: string, imagesManifest: Manifest): number {
  let count = 0;
  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item)) continue;
      if (item.people?.includes(personId)) {
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
      if (!isImageEntry(item)) continue;
      if (!item.people) continue;

      for (const personId of item.people) {
        const current = counts.get(personId);
        if (current !== undefined) {
          counts.set(personId, current + 1);
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

  // Check if directory exists before attempting to read
  if (!(await fileExists(personDir))) return "";

  const files = await readdir(personDir);
  const firstValid = files.find((file: string) => isJpegPath(file) && !file.startsWith("."));

  if (!firstValid) return "";

  return `faces/${personId}/${firstValid}`;
}

/**
 * Refreshes the person's thumbnail if the current one is invalid or missing.
 * Should be called after moving/deleting face crops.
 */
export async function refreshPersonThumbnail(person: Person, facesDir: string): Promise<void> {
  if (!person.thumbnail) {
    person.thumbnail = await findAvailableThumbnail(person.id, facesDir);
    return;
  }

  const thumb = person.thumbnail;
  let checkPath: string;

  if (thumb.includes("assets/avatars/")) {
    // It's a custom avatar, check if it exists in assets
    // We assume facesDir is ".../faces", so assetsDir is ".../assets"
    const assetsDir = path.resolve(facesDir, "../assets");
    checkPath = path.resolve(assetsDir, "avatars", path.basename(thumb));
  } else {
    // It's a face crop
    checkPath = path.resolve(facesDir, person.id, path.basename(thumb));
  }

  // If the current thumbnail (avatar or face crop) effectively exists, we are done
  if (await fileExists(checkPath)) {
    return;
  }

  // Thumbnail missing, fall back to finding a new face crop
  person.thumbnail = await findAvailableThumbnail(person.id, facesDir);
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

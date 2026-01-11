/**
 * @fileoverview Person Reference Utilities
 *
 * Shared utilities for updating person references across manifests.
 * Used by rename, reassign, unmatch, and merge endpoints.
 */

import { type FacesManifest, isImageEntry, type Manifest } from "../../../src/lib/types/manifest";

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
      item.people = item.people.map(function (id) {
        return id === oldPersonId ? newPersonId : id;
      });
      item.people = [...new Set(item.people)]; // Dedupe
      updatedCount++;

      // Sync faces manifest
      const faceData = facesManifest[item.id];
      if (faceData?.peopleIds?.includes(oldPersonId)) {
        // DO NOT DEDUPE faces.manifest IDs! define 1:1 mapping with faces array.
        faceData.peopleIds = faceData.peopleIds.map(function (id) {
          return id === oldPersonId ? newPersonId : id;
        });
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

      item.people = item.people.map(function (id) {
        return id === oldPersonId ? newPersonId : id;
      });
      item.people = [...new Set(item.people)];
      updated = true;
    }
  }

  if (facesManifest[imageId]) {
    const faceData = facesManifest[imageId];
    if (faceData.peopleIds?.includes(oldPersonId)) {
      // DO NOT DEDUPE faces.manifest IDs! define 1:1 mapping with faces array.
      faceData.peopleIds = faceData.peopleIds.map(function (id) {
        return id === oldPersonId ? newPersonId : id;
      });
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

      item.people = item.people.filter(function (id) {
        return id !== personId;
      });
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

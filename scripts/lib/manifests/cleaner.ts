/**
 * @fileoverview Manifest cleaning utilities.
 *
 * @description
 * Remove orphaned entries, enforce schema constraints and tidy manifest files.
 */
import { createLogger } from "$scripts/core/cli-logger";
import {
  loadFacesManifest,
  loadImagesManifest,
  saveFacesManifest,
  saveImagesManifest,
} from "$scripts/manifests/repository";
import { fileExists } from "$scripts/utils/runtime";
import { JPEG_EXTENSIONS } from "$shared/types/images";
import type { FacesManifest, Manifest, PeopleManifest } from "$shared/types/manifest";
import path from "node:path";

const logger = createLogger("manifest-cleaner");

export interface PhantomCleanupResult {
  totalChecked?: number; // Optional, as cleaner might not track checked count accurately
  totalRemoved: number;
  facesRemoved: number;
}

/**
 * Removes person assignments from images.manifest.json where no corresponding face crop exists on disk.
 */
export async function cleanPhantomAssignments(
  gallery: string,
  imagesManifest: Manifest,
  facesManifest: FacesManifest | null,
): Promise<PhantomCleanupResult> {
  const facesDir = path.resolve(process.cwd(), `static-${gallery}/faces`);

  let totalRemoved = 0;
  let facesRemoved = 0;
  let totalChecked = 0;

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "separator" || !item.people || item.people.length === 0) {
        continue;
      }
      totalChecked++;

      const validPeople: string[] = [];

      for (const personId of item.people) {
        const cropBase = path.join(facesDir, personId, item.id);

        // Check for common extensions
        let exists = false;

        for (const ext of JPEG_EXTENSIONS) {
          if (await fileExists(`${cropBase}${ext}`)) {
            exists = true;
            break;
          }
        }

        if (!exists) {
          logger.warn(
            { personId, imageId: item.id },
            "Removing phantom: Assignment removed (crop missing)",
          );
          totalRemoved++;

          // Also remove from faces manifest if present
          if (facesManifest?.[item.id]?.peopleIds) {
            const idx = facesManifest[item.id].peopleIds.indexOf(personId);
            if (idx !== -1) {
              facesManifest[item.id].peopleIds.splice(idx, 1);
              facesRemoved++;
            }
          }
          continue;
        }

        validPeople.push(personId);
      }

      if (validPeople.length === 0) {
        delete item.people;
      } else {
        item.people = validPeople;
      }
    }
  }

  return { totalRemoved, facesRemoved, totalChecked };
}

/**
 * Clean people.manifest.json:
 * Removes 'thumbnail' property if the file does not exist on disk.
 */
export async function cleanPhantomPeopleThumbnails(
  gallery: string,
  peopleManifest: PeopleManifest,
): Promise<{ cleanedThumbnails: number }> {
  const staticDir = path.resolve(process.cwd(), `static-${gallery}`);
  let cleanedThumbnails = 0;

  for (const person of peopleManifest.people) {
    if (person.thumbnail) {
      const thumbPath = path.join(staticDir, person.thumbnail);
      // We assume person.thumbnail is relative to static root (e.g. faces/person-1/img.jpg)
      // but let's verify if file exists
      const exists = await fileExists(thumbPath);
      if (!exists) {
        logger.warn(
          { personId: person.id, thumbnail: person.thumbnail },
          "Removing phantom thumbnail (file missing)",
        );
        person.thumbnail = "";
        cleanedThumbnails++;
      }
    }
  }

  return { cleanedThumbnails };
}

/**
 * Standalone runner that loads manifests, cleans phantoms, and saves if changed.
 */
export async function runStandalonePhantomCleanup(gallery: string): Promise<PhantomCleanupResult> {
  const dataDir = path.resolve(`src/data/${gallery}`);

  const imagesManifest = await loadImagesManifest(dataDir);
  const facesManifest = await loadFacesManifest(dataDir);

  if (!imagesManifest) {
    throw new Error(`Images manifest not found for ${gallery}`);
  }

  const result = await cleanPhantomAssignments(gallery, imagesManifest, facesManifest);

  if (result.totalRemoved > 0 || result.facesRemoved > 0) {
    logger.info({ ...result }, "Changes detected, saving manifests...");
    await saveImagesManifest(dataDir, imagesManifest);
    if (facesManifest) {
      await saveFacesManifest(dataDir, facesManifest);
    }
  }

  return result;
}

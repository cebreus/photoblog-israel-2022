import path from "node:path";
import { createLogger } from "$scripts/lib/core/cli-logger";
import { loadImagesManifest, saveImagesManifest } from "$scripts/lib/manifests/repository";

const logger = createLogger("manifest-cleaner");

/**
 * Removes person assignments from images.manifest.json where no corresponding face crop exists on disk.
 */
export async function cleanPhantomAssignments(contentDir: string) {
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const facesDir = path.resolve(process.cwd(), "static", contentDir, "faces");

  const imagesManifest = await loadImagesManifest(dataDir);
  if (!imagesManifest) {
    return { totalChecked: 0, totalRemoved: 0 };
  }

  let totalRemoved = 0;
  let totalChecked = 0;

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (item.type !== "image" || !item.people || item.people.length === 0) {
        continue;
      }

      totalChecked++;
      const validPeople: string[] = [];

      for (const personId of item.people) {
        const cropPath = path.join(facesDir, personId, `${item.id}.jpg`);
        const exists = await Bun.file(cropPath).exists();

        if (exists) {
          validPeople.push(personId);
        } else {
          logger.warn(`Removing phantom: ${personId} from ${item.id} (crop missing)`);
          totalRemoved++;
        }
      }

      if (validPeople.length === 0) {
        delete item.people;
      } else {
        item.people = validPeople;
      }
    }
  }

  if (totalRemoved > 0) {
    await saveImagesManifest(dataDir, imagesManifest);
  }

  return { totalChecked, totalRemoved };
}

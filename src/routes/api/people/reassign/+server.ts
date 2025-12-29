import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import { validateReassignInput } from "$lib/utils/api-validators";
import { addReassignmentConstraints } from "$scripts/lib/faces/constraints";
import { refreshPersonThumbnail, updateImagePersonReference } from "$scripts/lib/faces/people";
import { removeEmptyPersonFolder } from "$scripts/lib/gallery/cleanup";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "$scripts/lib/manifests/repository";

const logger = createLogger("api:people:reassign");

/**
 * Reassigns selected images from one person to another.
 * Moves face crops, updates manifests, and records reassignment constraints.
 */
export async function POST({ request }: { request: Request }) {
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }

  const body = await request.json();
  const validation = validateReassignInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { sourcePersonId, targetPersonId, imageIds } = validation.data;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const facesDir = path.resolve(process.cwd(), "static", contentDir, "faces");

  try {
    return await withManifestLock(dataDir, async function () {
      const peopleManifest = await loadPeopleManifest(dataDir);
      const imagesManifest = await loadImagesManifest(dataDir);
      const facesManifest = (await loadFacesManifest(dataDir)) || {};

      if (!peopleManifest || !imagesManifest) throw new Error("Manifests missing");

      const sourcePerson = peopleManifest.people.find((person) => person.id === sourcePersonId);
      const targetPerson = peopleManifest.people.find((person) => person.id === targetPersonId);

      if (!sourcePerson || !targetPerson) throw new Error("Person not found");

      const transactionLog: Array<{ from: string; to: string }> = [];

      try {
        await fsp.mkdir(path.resolve(facesDir, targetPersonId), { recursive: true });

        let movedCount = 0;
        for (const id of imageIds) {
          const updated = updateImagePersonReference(
            imagesManifest,
            facesManifest,
            id,
            sourcePersonId,
            targetPersonId,
          );
          if (updated) {
            const oldPath = path.resolve(facesDir, sourcePersonId, `${id}.jpg`);
            const newPath = path.resolve(facesDir, targetPersonId, `${id}.jpg`);
            try {
              await fsp.rename(oldPath, newPath);
              transactionLog.push({ from: oldPath, to: newPath });
              movedCount++;
            } catch (e) {
              // Ignore if file is missing (ENOENT), strictly throw on other errors
              if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
                throw e;
              }
            }
          }
        }

        sourcePerson.faceCount = Math.max(0, sourcePerson.faceCount - movedCount);
        targetPerson.faceCount += movedCount;

        await addReassignmentConstraints(dataDir, imageIds, sourcePersonId, targetPersonId);

        // Source cleanup
        if (sourcePerson.faceCount === 0) {
          peopleManifest.people = peopleManifest.people.filter(
            (person) => person.id !== sourcePersonId,
          );
          await removeEmptyPersonFolder(facesDir, sourcePersonId);
        } else {
          // Person remains, ensure they have a valid thumbnail (in case we moved the cover photo)
          await refreshPersonThumbnail(sourcePerson, facesDir);
        }

        await savePeopleManifest(dataDir, peopleManifest);
        await saveImagesManifest(dataDir, imagesManifest);
        await saveFacesManifest(dataDir, facesManifest);

        return json({ success: true, movedCount });
      } catch (err) {
        // Rollback transaction
        if (transactionLog.length > 0) {
          logger.warn(
            `[REASSIGN] Error occurred. Rolling back ${transactionLog.length} file moves...`,
          );
          for (const log of transactionLog.reverse()) {
            try {
              await fsp.rename(log.to, log.from);
            } catch (rollbackErr) {
              logger.error(`[REASSIGN] Rollback failed for ${log.to} -> ${log.from}`, rollbackErr);
            }
          }
        }
        throw err;
      }
    });
  } catch (err) {
    logger.error("[REASSIGN] Failure:", err);
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

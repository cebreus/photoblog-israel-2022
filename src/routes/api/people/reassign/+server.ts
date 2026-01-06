import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { clearTaskStatus, saveTaskStatus } from "$lib/server/task-status";
import { validateReassignInput } from "$lib/utils/api-validators";
import { reloadManifests } from "$lib/utils/images";
import { addReassignmentConstraints } from "$scripts/lib/faces/constraints";
import {
  recalculateFaceCount,
  refreshPersonThumbnail,
  updateImagePersonReference,
} from "$scripts/lib/faces/people";
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

/**
 * Reassigns selected images from one person to another.
 * Moves face crops, updates manifests, and records reassignment constraints.
 */
export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const { log, logContext } = locals;
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }

  const body = await request.json();

  // Set logContext early for request tracing
  logContext.sourcePersonId = body.sourcePersonId;
  logContext.targetPersonId = body.targetPersonId;
  logContext.imageCount = body.imageIds?.length;

  const validation = validateReassignInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { sourcePersonId, targetPersonId, imageIds } = validation.data;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const facesDir = path.resolve(process.cwd(), "static", contentDir, "faces");

  // Set task status before starting
  await saveTaskStatus(dataDir, {
    id: "face-reassignment",
    label: "Přeřazování obličejů...",
  });

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

        sourcePerson.faceCount = recalculateFaceCount(sourcePersonId, imagesManifest);
        targetPerson.faceCount = recalculateFaceCount(targetPersonId, imagesManifest);

        // Ensure target person has a valid thumbnail (especially if it was empty or changed)
        await refreshPersonThumbnail(targetPerson, facesDir);

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

        // Force reload of in-memory manifest cache
        await reloadManifests();

        return json({ success: true, movedCount });
      } catch (err) {
        // Rollback transaction
        if (transactionLog.length > 0) {
          log.warn(
            { rollbackCount: transactionLog.length },
            "REASSIGN: Error occurred, rolling back file moves",
          );
          for (const logEntry of transactionLog.reverse()) {
            try {
              await fsp.rename(logEntry.to, logEntry.from);
            } catch (rollbackErr) {
              log.error(
                { err: rollbackErr, from: logEntry.to, to: logEntry.from },
                "REASSIGN: Rollback failed",
              );
            }
          }
        }
        throw err;
      }
    });
  } catch (err) {
    log.error({ err }, "REASSIGN: Failure");
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await clearTaskStatus(dataDir);
  }
}

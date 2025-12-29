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

async function moveFaceCrop(
  facesDir: string,
  imgId: string,
  oldPersonId: string,
  newPersonId: string,
) {
  const oldPath = path.resolve(facesDir, oldPersonId, `${imgId}.jpg`);
  const newPath = path.resolve(facesDir, newPersonId, `${imgId}.jpg`);
  try {
    await fsp.rename(oldPath, newPath);
  } catch {
    /* ignore if faceCrop missing */
  }
}

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
          await moveFaceCrop(facesDir, id, sourcePersonId, targetPersonId);
          movedCount++;
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
    });
  } catch (err) {
    logger.error("[REASSIGN] Failure:", err);
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

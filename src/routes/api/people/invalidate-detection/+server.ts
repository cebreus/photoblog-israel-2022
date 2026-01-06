import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { type FacesManifest, isImageEntry } from "$lib/types/manifest";
import { validateIgnoreFaceInput } from "$lib/utils/api-validators";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { refreshPersonThumbnail } from "$scripts/lib/faces/people";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadClusteringConstraints,
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveClusteringConstraints,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "$scripts/lib/manifests/repository";

/**
 * Endpoint to mark a specific detection as invalid (e.g. not a face).
 * This is a destructive operation that removes the assignment and records a constraint.
 */
export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const { log, logContext } = locals;
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }

  const body = await request.json();
  const validation = validateIgnoreFaceInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, imageId, box } = validation.data;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const facesDir = path.resolve(process.cwd(), "static", contentDir, "faces");

  try {
    return await withManifestLock(dataDir, async function () {
      const peopleManifest = await loadPeopleManifest(dataDir);
      const imagesManifest = await loadImagesManifest(dataDir);
      const facesManifest: FacesManifest = (await loadFacesManifest(dataDir)) || {};

      if (!peopleManifest || !imagesManifest) throw new Error("Manifests missing");

      // 1. Remove from faces.manifest
      if (facesManifest[imageId]) {
        const faceDetail = facesManifest[imageId];
        if (faceDetail.peopleIds) {
          faceDetail.peopleIds = faceDetail.peopleIds.filter(
            (currentPersonId) => currentPersonId !== personId,
          );
        }
      }

      // 2. Remove from images.manifest
      for (const day of imagesManifest.photoDays) {
        for (const item of day.items) {
          if (isImageEntry(item) && item.id === imageId && item.people) {
            item.people = item.people.filter((currentPersonId) => currentPersonId !== personId);
          }
        }
      }

      // 3. Update faceCount
      const targetPerson = peopleManifest.people.find((person) => person.id === personId);
      if (targetPerson) {
        targetPerson.faceCount = Math.max(0, targetPerson.faceCount - 1);

        // 3.5 Delete the physical face crop file
        const facePath = path.resolve(facesDir, personId, `${imageId}.jpg`);
        try {
          await fsp.unlink(facePath);
        } catch (e) {
          // Ignore if file already gone
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
            log.warn({ err: e, path: facePath }, "Failed to delete invalid face crop");
          }
        }

        // Ensure thumbnail is still valid (especially if we just deleted the cover photo)
        await refreshPersonThumbnail(targetPerson, facesDir);
      }

      // 4. Update constraints
      let constraints = await loadClusteringConstraints(dataDir);
      if (!constraints) {
        constraints = { disconnects: [], connects: [], invalidDetections: [] };
      }
      if (!constraints.invalidDetections) constraints.invalidDetections = [];

      // Prevent duplicates - boxes within threshold are considered the same
      const BOX_MATCH_THRESHOLD = 0.1; // 10% tolerance for position matching
      const exists = constraints.invalidDetections.some(
        (detection) =>
          detection.imageId === imageId &&
          Math.abs(detection.box.x - box.x) < BOX_MATCH_THRESHOLD &&
          Math.abs(detection.box.y - box.y) < BOX_MATCH_THRESHOLD,
      );

      if (!exists) {
        constraints.invalidDetections.push({ imageId, box });
      }

      await saveClusteringConstraints(dataDir, constraints);
      await savePeopleManifest(dataDir, peopleManifest);
      await saveImagesManifest(dataDir, imagesManifest);
      await saveFacesManifest(dataDir, facesManifest);

      // Force reload of in-memory manifest cache
      await reloadManifests();

      logContext.personId = personId;
      logContext.imageId = imageId;
      return json({ success: true });
    });
  } catch (err) {
    log.error({ err }, "INVALIDATE-DETECTION: Failure");
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

import { dev } from "$app/environment";
import { type FacesManifest, isImageEntry } from "$lib/types/manifest";
import { validateInvalidateDetectionsInput } from "$lib/utils/api-validators";
import { reloadManifests } from "$lib/utils/manifest-loader";
import type { Logger as ScriptLogger } from "$scripts/core/cli-logger";
import { refreshPersonThumbnail } from "$scripts/faces/people";
import { removeEmptyPersonFolder } from "$scripts/gallery/cleanup";
import { withManifestLock } from "$scripts/manifests/lock";
import {
  loadClusteringConstraints,
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  savePeopleRelatedManifests,
} from "$scripts/manifests/repository";
import { unlink } from "$scripts/utils/runtime";
import { error, json } from "@sveltejs/kit";
import path from "node:path";

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
  const validation = validateInvalidateDetectionsInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, detections } = validation.data;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const facesDir = path.resolve(process.cwd(), `static-${contentDir}`, "faces");

  // Adapt backend logger to script logger interface for helper functions
  const scriptLog = {
    error: log.error.bind(log),
    warn: log.warn.bind(log),
    info: log.info.bind(log),
    debug: log.debug.bind(log),
    verbose: log.debug.bind(log),
    raw: (msg: string) => log.info({ raw: msg }, "SCRIPT_OUTPUT"),
    silent: false,
    level: log.level,
  } as unknown as ScriptLogger;

  try {
    return await withManifestLock(dataDir, async function () {
      const peopleManifest = await loadPeopleManifest(dataDir);
      const imagesManifest = await loadImagesManifest(dataDir);
      const facesManifest: FacesManifest = (await loadFacesManifest(dataDir)) || {};

      if (!peopleManifest || !imagesManifest) throw new Error("Manifests missing");

      let constraints = (await loadClusteringConstraints(dataDir)) || {
        disconnects: [],
        connects: [],
        invalidDetections: [],
      };
      if (!constraints.invalidDetections) constraints.invalidDetections = [];

      const targetPerson = peopleManifest.people.find((person) => person.id === personId);
      if (!targetPerson) {
        log.warn(
          { personId },
          "INVALIDATE: Target person not found (might have been removed already)",
        );
      }

      for (const { imageId, box } of detections) {
        let indicesToRemove: number[] = [];

        // 1. Identify indices to remove from faces.manifest
        if (facesManifest[imageId]) {
          const faceDetail = facesManifest[imageId];

          if (faceDetail.faces && faceDetail.peopleIds) {
            // Safety check for corruption
            if (faceDetail.faces.length !== faceDetail.peopleIds.length) {
              log.warn(
                {
                  imageId,
                  faceCount: faceDetail.faces.length,
                  peopleCount: faceDetail.peopleIds.length,
                },
                "INVALIDATE: Data corruption detected (length mismatch). Proceeding with cleanup.",
              );
            }

            if (box) {
              // Match by geometry with tolerance
              const BOX_MATCH_THRESHOLD = 0.1;

              // Find matching index where personId matches AND box matches
              // We search specifically for the target person's assignment at the matching location
              faceDetail.faces.forEach((faceBox, idx) => {
                const currentPersonId = faceDetail.peopleIds[idx];
                if (currentPersonId === personId) {
                  const isGeoMatch =
                    Math.abs(faceBox.x - box.x) < BOX_MATCH_THRESHOLD &&
                    Math.abs(faceBox.y - box.y) < BOX_MATCH_THRESHOLD &&
                    Math.abs(faceBox.width - box.width) < BOX_MATCH_THRESHOLD &&
                    Math.abs(faceBox.height - box.height) < BOX_MATCH_THRESHOLD;

                  if (isGeoMatch) {
                    indicesToRemove.push(idx);
                  }
                }
              });
            } else {
              // No box provided -> FORCE INVALIDATE all occurrences of this person in this image
              log.info(
                { imageId, personId },
                "INVALIDATE: Force mode (no box), removing all instances of person",
              );
              faceDetail.peopleIds.forEach((pid, idx) => {
                if (pid === personId) {
                  indicesToRemove.push(idx);
                }
              });
            }

            // Remove from LAST to FIRST to avoid index shifting problems
            indicesToRemove.sort((a, b) => b - a);

            for (const idx of indicesToRemove) {
              // SPLICE ALL PARALLEL ARRAYS
              faceDetail.faces.splice(idx, 1);
              faceDetail.peopleIds.splice(idx, 1);
              if (faceDetail.descriptors) {
                faceDetail.descriptors.splice(idx, 1);
              }
            }

            // Update facesDetected flag
            faceDetail.facesDetected = faceDetail.faces.length > 0;
          }
        }

        // 2. Remove from images.manifest
        for (const day of imagesManifest.photoDays) {
          for (const item of day.items) {
            if (isImageEntry(item) && item.id === imageId && item.people) {
              item.people = item.people.filter((currentId: string) => currentId !== personId);
            }
          }
        }

        // 3. Update faceCount and delete crop
        if (targetPerson) {
          // If we removed N faces, decrement by N (usually 1, but could be more in force mode)
          const itemsRemoved = indicesToRemove.length > 0 ? indicesToRemove.length : 1;
          targetPerson.faceCount = Math.max(0, targetPerson.faceCount - itemsRemoved);

          // 3.5 Delete the physical face crop file
          const facePath = path.resolve(facesDir, personId, `${imageId}.jpg`);
          try {
            await unlink(facePath);
          } catch (e) {
            // Ignore if file already gone
            if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
              log.warn({ err: e, path: facePath }, "Failed to delete invalid face crop");
            }
          }
        }

        // 4. Update constraints
        if (box) {
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
          } else {
            log.warn({ imageId }, "INVALIDATE: Constraint already exists, skipping duplicate");
          }
        } else {
          log.info({ imageId }, "INVALIDATE: Skipping constraint creation (no box data available)");
        }
      }

      // Cleanup if person remains or not
      if (targetPerson) {
        if (targetPerson.faceCount <= 0) {
          peopleManifest.people = peopleManifest.people.filter((p) => p.id !== personId);
          await removeEmptyPersonFolder(facesDir, personId, scriptLog);
        } else {
          // Person remains, ensure thumbnail is still valid
          await refreshPersonThumbnail(targetPerson, facesDir);
        }
      }

      // Atomically save all manifests - either all succeed or none
      await savePeopleRelatedManifests(dataDir, {
        people: peopleManifest,
        images: imagesManifest,
        faces: facesManifest,
        constraints,
      });

      // Force reload of in-memory manifest cache
      await reloadManifests();

      logContext.personId = personId;
      logContext.detectionsCount = detections.length;
      return json({ success: true, count: detections.length });
    });
  } catch (err) {
    log.error({ err }, "INVALIDATE-DETECTION: Failure");
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

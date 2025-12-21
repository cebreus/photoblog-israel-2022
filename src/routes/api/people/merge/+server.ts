import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { ImageEntry } from "$lib/types/manifest";
import { validateMergeInput } from "$lib/utils/api-validators";
import type { ClusteringConstraints } from "$lib/utils/manifest-validators";
import { removeEmptyPersonFolder } from "../../../../../scripts/lib/cleanup-utils";
import { createLogger } from "../../../../../scripts/lib/logger";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "../../../../../scripts/lib/manifest-repository";
import { hasValidFaceDescriptor } from "../../../../../scripts/lib/people-utils";

const logger = createLogger("people-api");

export async function POST({ request }) {
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }
  const body = await request.json();
  const validation = validateMergeInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { sourcePersonId, targetPersonId } = validation.data;

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);

  try {
    return await withManifestLock(dataDir, async () => {
      const peopleManifest = await loadPeopleManifest(dataDir);
      const imagesManifest = await loadImagesManifest(dataDir);
      const facesManifest = (await loadFacesManifest(dataDir)) || {};

      if (!peopleManifest || !imagesManifest) {
        return json({ success: false, error: "Manifests not found" }, { status: 500 });
      }

      const sourcePerson = peopleManifest.people.find((p) => p.id === sourcePersonId);
      const targetPerson = peopleManifest.people.find((p) => p.id === targetPersonId);

      if (!sourcePerson || !targetPerson) {
        return json({ success: false, error: "Person not found" }, { status: 404 });
      }

      logger.info(
        `[MERGE] Merging ${sourcePerson.name} (${sourcePersonId}) into ${targetPerson.name} (${targetPersonId})`,
      );

      const facesDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);
      const sourceDir = path.resolve(facesDir, sourcePersonId);
      const targetDir = path.resolve(facesDir, targetPersonId);
      await fsp.mkdir(targetDir, { recursive: true });

      let updatedImageCount = 0;
      for (const day of imagesManifest.photoDays) {
        for (const item of day.items) {
          if (item.type === "image") {
            const imageItem = item as ImageEntry;
            const id = imageItem.id;
            if (imageItem.people?.includes(sourcePersonId)) {
              const index = imageItem.people.indexOf(sourcePersonId);
              if (index !== -1) {
                const filename = `${id}.jpg`;
                const oldPath = path.resolve(sourceDir, filename);
                const newPath = path.resolve(targetDir, filename);

                try {
                  await fsp.stat(oldPath);
                  await fsp.rename(oldPath, newPath);
                } catch (_e) {}

                imageItem.people[index] = targetPersonId;
                imageItem.people = [...new Set(imageItem.people)];

                // Update faces manifest
                if (Object.hasOwn(facesManifest, id)) {
                  const faceData = facesManifest[id];
                  if (faceData.peopleIds?.includes(sourcePersonId)) {
                    faceData.peopleIds = faceData.peopleIds.map((pid: string) =>
                      pid === sourcePersonId ? targetPersonId : pid,
                    );
                    faceData.peopleIds = [...new Set(faceData.peopleIds)];
                  }
                }

                updatedImageCount++;
              }
            }
          }
        }
      }

      logger.info(`[MERGE] Updated ${updatedImageCount} images`);

      let sourceFaceCount = 0;
      let targetFaceCount = 0;

      for (const day of imagesManifest.photoDays) {
        for (const item of day.items) {
          if (item.type === "image") {
            const imageItem = item as ImageEntry;
            if (imageItem.people?.includes(sourcePersonId)) {
              sourceFaceCount++;
            }
            if (imageItem.people?.includes(targetPersonId)) {
              targetFaceCount++;
            }
          }
        }
      }

      const oldSourceFaceCount = sourcePerson.faceCount;
      const oldTargetFaceCount = targetPerson.faceCount;
      sourcePerson.faceCount = sourceFaceCount;
      targetPerson.faceCount = targetFaceCount;

      logger.info(`[MERGE] Source person faceCount: ${oldSourceFaceCount} → ${sourceFaceCount}`);
      logger.info(`[MERGE] Target person faceCount: ${oldTargetFaceCount} → ${targetFaceCount}`);

      if (hasValidFaceDescriptor(sourcePerson)) {
        if (!hasValidFaceDescriptor(targetPerson)) {
          targetPerson.faceDescriptor = sourcePerson.faceDescriptor;
          logger.info("[MERGE] Target person inherited descriptor from source");
        } else {
          const sourceDesc = sourcePerson.faceDescriptor;
          const targetDesc = targetPerson.faceDescriptor;

          const sourceWeight = oldSourceFaceCount;
          const targetWeight = oldTargetFaceCount;
          const totalWeight = sourceWeight + targetWeight;

          if (totalWeight > 0) {
            function calculateWeightedAverage(targetValue: number, index: number): number {
              const sourceValue = sourceDesc[index];
              return (targetValue * targetWeight + sourceValue * sourceWeight) / totalWeight;
            }

            const averagedDescriptor = targetDesc.map(calculateWeightedAverage);

            targetPerson.faceDescriptor = averagedDescriptor;
            logger.info(
              `[MERGE] Averaged face descriptors (weights: ${sourceWeight}:${targetWeight})`,
            );
          }
        }
      }

      const constraintsPath = path.resolve(
        process.cwd(),
        `src/data/${contentDir}/clustering-constraints.json`,
      );
      try {
        const cData = await fsp.readFile(constraintsPath, "utf-8");
        const constraints: ClusteringConstraints = JSON.parse(cData);
        let modified = false;

        if (constraints.disconnects && Array.isArray(constraints.disconnects)) {
          constraints.disconnects.forEach((c) => {
            if (c.personId === sourcePersonId) {
              c.personId = targetPersonId;
              modified = true;
            }
          });
          if (modified) {
            const seen = new Set();
            constraints.disconnects = constraints.disconnects.filter((c) => {
              const key = `${c.imageId}:${c.personId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
        }

        if (constraints.connects && Array.isArray(constraints.connects)) {
          constraints.connects.forEach((c) => {
            if (c.personId === sourcePersonId) {
              c.personId = targetPersonId;
              modified = true;
            }
          });
          if (modified) {
            const seen = new Set();
            constraints.connects = constraints.connects.filter((c) => {
              const key = `${c.imageId}:${c.personId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
        }

        if (modified) {
          await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
          logger.info(`[MERGE] Updated clustering-constraints.json`);
        }
      } catch (_e) {}

      // Remove source person from manifest
      peopleManifest.people = peopleManifest.people.filter((p) => p.id !== sourcePersonId);

      await savePeopleManifest(dataDir, peopleManifest);
      await saveImagesManifest(dataDir, imagesManifest);
      await saveFacesManifest(dataDir, facesManifest);

      const cleanedUp = await removeEmptyPersonFolder(facesDir, sourcePersonId);
      if (cleanedUp) {
        logger.info(`[MERGE] Removed empty source folder: ${sourcePersonId}`);
      }

      logger.info(`[MERGE] Merge completed successfully`);

      return json({
        success: true,
        mergedPerson: targetPerson,
        updatedImageCount,
        sourceOldFaceCount: oldSourceFaceCount,
        sourceNewFaceCount: sourceFaceCount,
        targetOldFaceCount: oldTargetFaceCount,
        targetNewFaceCount: targetFaceCount,
      });
    });
  } catch (error) {
    logger.error(`[MERGE] Error: ${error}`);
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError ? "Operation locked by another process" : "Failed to merge people",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

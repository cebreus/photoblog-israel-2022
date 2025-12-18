import type { ImageEntry, Manifest, PeopleManifest } from "$lib/types/manifest";
import { validateMergeInput } from "$lib/utils/api-validators";
import { json } from "@sveltejs/kit";
import fsp from "node:fs/promises";
import path from "node:path";
import { removeEmptyPersonFolder } from "../../../../../scripts/lib/cleanup-utils";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";
import { hasValidFaceDescriptor } from "../../../../../scripts/lib/people-utils";

export async function POST({ request }) {
  const body = await request.json();
  const validation = validateMergeInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { sourcePersonId, targetPersonId } = validation.data;

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const peopleManifestPath = path.join(dataDir, "people.manifest.json");
  const imagesManifestPath = path.join(dataDir, "images.manifest.json");

  try {
    return await withManifestLock(dataDir, async () => {
      const peopleManifest: PeopleManifest = JSON.parse(
        await fsp.readFile(peopleManifestPath, "utf-8"),
      );
      const imagesManifest: Manifest = JSON.parse(await fsp.readFile(imagesManifestPath, "utf-8"));

      const sourcePerson = peopleManifest.people.find((p) => p.id === sourcePersonId);
      const targetPerson = peopleManifest.people.find((p) => p.id === targetPersonId);

      if (!sourcePerson || !targetPerson) {
        return json({ success: false, error: "Person not found" }, { status: 404 });
      }

      console.log(
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
            if (imageItem.people && imageItem.people.includes(sourcePersonId)) {
              const index = imageItem.people.indexOf(sourcePersonId);
              if (index !== -1) {
                const filename = `${imageItem.id}.jpg`;
                const oldPath = path.resolve(sourceDir, filename);
                const newPath = path.resolve(targetDir, filename);

                try {
                  await fsp.stat(oldPath);

                  await fsp.rename(oldPath, newPath);
                } catch (e) {}

                imageItem.people[index] = targetPersonId;
                imageItem.people = [...new Set(imageItem.people)];
                updatedImageCount++;
              }
            }
          }
        }
      }

      console.log(`[MERGE] Updated ${updatedImageCount} images`);

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

      console.log(`[MERGE] Source person faceCount: ${oldSourceFaceCount} → ${sourceFaceCount}`);
      console.log(`[MERGE] Target person faceCount: ${oldTargetFaceCount} → ${targetFaceCount}`);

      if (hasValidFaceDescriptor(sourcePerson)) {
        if (!hasValidFaceDescriptor(targetPerson)) {
          targetPerson.faceDescriptor = sourcePerson.faceDescriptor;
          console.log("[MERGE] Target person inherited descriptor from source");
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
            console.log(
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
        const constraints = JSON.parse(cData);
        let modified = false;

        if (constraints.disconnects && Array.isArray(constraints.disconnects)) {
          constraints.disconnects.forEach((c: any) => {
            if (c.personId === sourcePersonId) {
              c.personId = targetPersonId;
              modified = true;
            }
          });
          if (modified) {
            const seen = new Set();
            constraints.disconnects = constraints.disconnects.filter((c: any) => {
              const key = `${c.imageId}:${c.personId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
        }

        if (constraints.connects && Array.isArray(constraints.connects)) {
          constraints.connects.forEach((c: any) => {
            if (c.personId === sourcePersonId) {
              c.personId = targetPersonId;
              modified = true;
            }
          });
          if (modified) {
            const seen = new Set();
            constraints.connects = constraints.connects.filter((c: any) => {
              const key = `${c.imageId}:${c.personId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
        }

        if (modified) {
          await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
          console.log(`[MERGE] Updated clustering-constraints.json`);
        }
      } catch (e) {}

      await fsp.writeFile(peopleManifestPath, JSON.stringify(peopleManifest, null, 2));
      await fsp.writeFile(imagesManifestPath, JSON.stringify(imagesManifest, null, 2));

      const cleanedUp = await removeEmptyPersonFolder(facesDir, sourcePersonId);
      if (cleanedUp) {
        console.log(`[MERGE] Removed empty source folder: ${sourcePersonId}`);
      }

      console.log(`[MERGE] Merge completed successfully`);

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
    console.error("[MERGE] Error:", error);
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError ? "Operace je blokována jiným procesem" : "Failed to merge people",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

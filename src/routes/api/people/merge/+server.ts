import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";
import type { ImageEntry, Manifest, PeopleManifest } from "$lib/types/manifest";

export async function POST({ request }) {
  const { sourcePersonId, targetPersonId } = await request.json();

  if (!sourcePersonId || !targetPersonId) {
    return json({ success: false, error: "Missing person IDs" }, { status: 400 });
  }

  if (sourcePersonId === targetPersonId) {
    return json({ success: false, error: "Cannot merge person with itself" }, { status: 400 });
  }

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const peopleManifestPath = path.resolve(
    process.cwd(),
    `src/data/${contentDir}/people.manifest.json`,
  );
  const imagesManifestPath = path.resolve(
    process.cwd(),
    `src/data/${contentDir}/images.manifest.json`,
  );

  try {
    // Load manifests
    const peopleManifest: PeopleManifest = JSON.parse(
      await fsp.readFile(peopleManifestPath, "utf-8"),
    );
    const imagesManifest: Manifest = JSON.parse(await fsp.readFile(imagesManifestPath, "utf-8"));

    // Find persons
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

    // Update all images: replace sourcePersonId with targetPersonId AND move files
    let updatedImageCount = 0;
    for (const day of imagesManifest.photoDays) {
      for (const item of day.items) {
        if (item.type === "image") {
          const imageItem = item as ImageEntry;
          if (imageItem.people && imageItem.people.includes(sourcePersonId)) {
            const index = imageItem.people.indexOf(sourcePersonId);
            if (index !== -1) {
              // Move file logic
              const filename = `${imageItem.id}.jpg`;
              const oldPath = path.resolve(sourceDir, filename);
              const newPath = path.resolve(targetDir, filename);

              try {
                // Check if source file exists before trying to move
                // We use stat to check existence
                await fsp.stat(oldPath);

                // If target exists, we might overwrite, which is acceptable for now
                // (merging duplicate detections) or we could skip.
                // Rename (move)
                await fsp.rename(oldPath, newPath);
              } catch (e) {
                // Source file usually missing or other FS error.
                // Log nicely but continue.
                // console.log(`[MERGE] Could not move file for ${imageItem.id}: ${(e as Error).message}`);
              }

              // Replace source with target
              imageItem.people[index] = targetPersonId;
              // Remove duplicates
              imageItem.people = [...new Set(imageItem.people)];
              updatedImageCount++;
            }
          }
        }
      }
    }

    console.log(`[MERGE] Updated ${updatedImageCount} images`);

    // DON'T remove source person - just leave it without photos
    // peopleManifest.people = peopleManifest.people.filter(p => p.id !== sourcePersonId);

    // Recalculate faceCount for both persons
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
    sourcePerson.faceCount = sourceFaceCount; // Should be 0 after merge
    targetPerson.faceCount = targetFaceCount;

    console.log(`[MERGE] Source person faceCount: ${oldSourceFaceCount} → ${sourceFaceCount}`);
    console.log(`[MERGE] Target person faceCount: ${oldTargetFaceCount} → ${targetFaceCount}`);

    // Average face descriptors to improve future matching
    // This prevents the merged person from being re-detected as separate
    if (sourcePerson.faceDescriptor && targetPerson.faceDescriptor) {
      const sourceDesc = sourcePerson.faceDescriptor;
      const targetDesc = targetPerson.faceDescriptor;

      // Weighted average based on face counts (before merge)
      const sourceWeight = oldSourceFaceCount;
      const targetWeight = oldTargetFaceCount;
      const totalWeight = sourceWeight + targetWeight;

      if (totalWeight > 0) {
        const averagedDescriptor = targetDesc.map((val, i) => {
          return (val * targetWeight + sourceDesc[i] * sourceWeight) / totalWeight;
        });

        targetPerson.faceDescriptor = averagedDescriptor;
        console.log(`[MERGE] Averaged face descriptors (weights: ${sourceWeight}:${targetWeight})`);
      }
    }

    // Save both manifests
    await fsp.writeFile(peopleManifestPath, JSON.stringify(peopleManifest, null, 2));
    await fsp.writeFile(imagesManifestPath, JSON.stringify(imagesManifest, null, 2));

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
  } catch (error) {
    console.error("[MERGE] Error merging people:", error);
    return json({ success: false, error: "Failed to merge people" }, { status: 500 });
  }
}

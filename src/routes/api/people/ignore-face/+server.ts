import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";
import type { FacesManifest, ImageEntry } from "$lib/types/manifest";
import { validateIgnoreFaceInput } from "$lib/utils/api-validators";
import type { ClusteringConstraints } from "$lib/utils/manifest-validators";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "../../../../../scripts/lib/manifest-repository";

export async function POST({ request }) {
  const body = await request.json();
  const validation = validateIgnoreFaceInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, imageId, box } = validation.data;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const staticDir = path.resolve(process.cwd(), `static/${contentDir}`);
  const facesDir = path.join(staticDir, "faces");
  const constraintsPath = path.join(dataDir, "clustering-constraints.json");

  try {
    return await withManifestLock(dataDir, async () => {
      const peopleManifest = await loadPeopleManifest(dataDir);
      const imagesManifest = await loadImagesManifest(dataDir);
      // Ensure defaults to Record, not { images: {} }
      const facesManifest: FacesManifest = (await loadFacesManifest(dataDir)) || {};

      if (!peopleManifest || !imagesManifest) {
        return json({ success: false, error: "Manifests not found" }, { status: 500 });
      }

      // 1. Update Constraints
      let constraints: ClusteringConstraints = { disconnects: [], connects: [], ignoredCrops: [] };
      try {
        const data = await fsp.readFile(constraintsPath, "utf-8");
        constraints = JSON.parse(data);
      } catch (e) {}

      if (!constraints.ignoredCrops) constraints.ignoredCrops = [];

      // Check if already ignored
      const exists = constraints.ignoredCrops.some(
        (c) =>
          c.imageId === imageId && Math.abs(c.box.x - box.x) < 1 && Math.abs(c.box.y - box.y) < 1,
      );

      if (!exists && constraints.ignoredCrops) {
        constraints.ignoredCrops.push({ imageId, box });
        await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
      }

      // 2. Remove from Current Person
      const person = peopleManifest.people.find((p) => p.id === personId);
      if (person) {
        person.faceCount = Math.max(0, person.faceCount - 1);

        // Delete face crop file
        const faceCropPath = path.join(facesDir, personId, `${imageId}.jpg`);
        try {
          await fsp.unlink(faceCropPath);
        } catch (e) {}

        // If person has no more faces and is not a custom person, we could optionally leave it or delete it.
        // For now, just decrement count.
      }

      // 3. Update Image & Faces Manifest
      for (const day of imagesManifest.photoDays) {
        for (const item of day.items) {
          if (item.type === "image" && (item as ImageEntry).id === imageId) {
            const img = item as ImageEntry;
            if (img.people) {
              img.people = img.people.filter((pid: string) => pid !== personId);
            }
          }
        }
      }

      const faceData = facesManifest[imageId];
      if (faceData && faceData.peopleIds) {
        faceData.peopleIds = faceData.peopleIds.filter((pid: string) => pid !== personId);
      }

      await savePeopleManifest(dataDir, peopleManifest);
      await saveImagesManifest(dataDir, imagesManifest);
      await saveFacesManifest(dataDir, facesManifest);

      return json({ success: true });
    });
  } catch (error) {
    console.error("[IGNORE-FACE] Error:", error);
    return json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}

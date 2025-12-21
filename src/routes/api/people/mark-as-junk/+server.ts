import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { FaceDetail, FacesManifest, ImageEntry } from "$lib/types/manifest";
import { validateMarkAsJunkInput } from "$lib/utils/api-validators";
import type { ClusteringConstraints } from "$lib/utils/manifest-validators";
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

const logger = createLogger("api:people:junk");

export async function POST({ request }) {
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }
  const body = await request.json();
  const validation = validateMarkAsJunkInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId } = validation.data;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const staticDir = path.resolve(process.cwd(), `static/${contentDir}`);
  const facesDir = path.join(staticDir, "faces");
  const constraintsPath = path.join(dataDir, "clustering-constraints.json");

  try {
    return await withManifestLock(dataDir, async () => {
      const peopleManifest = await loadPeopleManifest(dataDir);
      const imagesManifest = await loadImagesManifest(dataDir);
      const facesManifest: FacesManifest = (await loadFacesManifest(dataDir)) || {};

      if (!peopleManifest || !imagesManifest) {
        return json({ success: false, error: "Manifests not found" }, { status: 500 });
      }

      const person = peopleManifest.people.find((p) => p.id === personId);
      if (!person) {
        return json({ success: false, error: "Person not found" }, { status: 404 });
      }

      // 1. Gather all ignored crops
      const ignoredCropsToAdd: { imageId: string; box: FaceDetail }[] = [];
      const processedImages = new Set<string>();

      // Iterate through images manifest to find where this person is
      for (const day of imagesManifest.photoDays) {
        for (const item of day.items) {
          if (item.type === "image" && (item as ImageEntry).people?.includes(personId)) {
            const img = item as ImageEntry;
            processedImages.add(img.id);

            const personIndex = img.people?.indexOf(personId) ?? -1;
            if (personIndex !== -1 && img.analysis?.faces && img.analysis.faces[personIndex]) {
              ignoredCropsToAdd.push({
                imageId: img.id,
                box: img.analysis.faces[personIndex],
              });
            }

            // Remove from image
            if (img.people) {
              img.people = img.people.filter((pid: string) => pid !== personId);
            }
          }
        }
      }

      // Also check faces manifest for consistency
      for (const [imageId, faceData] of Object.entries(facesManifest)) {
        if (faceData.peopleIds?.includes(personId)) {
          if (!processedImages.has(imageId)) {
            // This shouldn't really happen if manifests are in sync, but for safety:
            const personIndex = faceData.peopleIds.indexOf(personId);
            if (personIndex !== -1 && faceData.faces && faceData.faces[personIndex]) {
              ignoredCropsToAdd.push({
                imageId,
                box: faceData.faces[personIndex],
              });
            }
          }
          faceData.peopleIds = faceData.peopleIds.filter((pid: string) => pid !== personId);
        }
      }

      // 2. Update Constraints
      let constraints: ClusteringConstraints = { disconnects: [], connects: [], ignoredCrops: [] };
      try {
        const data = await fsp.readFile(constraintsPath, "utf-8");
        constraints = JSON.parse(data);
      } catch (_e) {}

      if (!constraints.ignoredCrops) constraints.ignoredCrops = [];

      for (const newCrop of ignoredCropsToAdd) {
        if (!constraints.ignoredCrops) constraints.ignoredCrops = [];
        const exists = constraints.ignoredCrops.some(
          (c) =>
            c.imageId === newCrop.imageId &&
            Math.abs(c.box.x - newCrop.box.x) < 1 &&
            Math.abs(c.box.y - newCrop.box.y) < 1,
        );
        if (!exists) {
          constraints.ignoredCrops.push(newCrop);
        }
      }

      await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));

      // 3. Delete face crop files
      const personFacesDir = path.join(facesDir, personId);
      try {
        await fsp.rm(personFacesDir, { recursive: true, force: true });
      } catch (_e) {}

      // 4. Remove person from people manifest
      peopleManifest.people = peopleManifest.people.filter((p) => p.id !== personId);

      await savePeopleManifest(dataDir, peopleManifest);
      await saveImagesManifest(dataDir, imagesManifest);
      await saveFacesManifest(dataDir, facesManifest);

      return json({ success: true });
    });
  } catch (error) {
    logger.error("[MARK-AS-JUNK] Error:", error);
    return json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}

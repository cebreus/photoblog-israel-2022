import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";
import type { ImageEntry } from "$lib/types/manifest";
import { validateReassignInput } from "$lib/utils/api-validators";
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
  const validation = validateReassignInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { sourcePersonId, targetPersonId, imageIds } = validation.data;

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const facesDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);

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

      const sourceDir = path.resolve(facesDir, sourcePersonId);
      const targetDir = path.resolve(facesDir, targetPersonId);
      await fsp.mkdir(targetDir, { recursive: true });

      let movedCount = 0;

      for (const id of imageIds) {
        let imageUpdated = false;

        // Update main manifest
        for (const day of imagesManifest.photoDays) {
          for (const item of day.items) {
            if (item.type === "image" && item.id === id) {
              const img = item as ImageEntry;
              if (img.people?.includes(sourcePersonId)) {
                img.people = img.people.filter((pid) => pid !== sourcePersonId);
                img.people.push(targetPersonId);
                img.people = [...new Set(img.people)];
                imageUpdated = true;
              }
            }
          }
        }

        // Update faces manifest
        if (Object.hasOwn(facesManifest, id)) {
          const faceData = facesManifest[id];
          if (faceData.peopleIds?.includes(sourcePersonId)) {
            faceData.peopleIds = faceData.peopleIds.filter((pid: string) => pid !== sourcePersonId);
            faceData.peopleIds.push(targetPersonId);
            faceData.peopleIds = [...new Set(faceData.peopleIds)];
            imageUpdated = true;
          }
        }

        if (imageUpdated) {
          const filename = `${id}.jpg`;
          const oldPath = path.resolve(sourceDir, filename);
          const newPath = path.resolve(targetDir, filename);

          try {
            await fsp.stat(oldPath);
            await fsp.rename(oldPath, newPath);
          } catch (e) {
            console.warn(`[REASSIGN] File move failed or file missing: ${oldPath}`);
          }
          movedCount++;
        }
      }

      // Update face counts manually (more efficient than full recount here)
      sourcePerson.faceCount = Math.max(0, sourcePerson.faceCount - movedCount);
      targetPerson.faceCount += movedCount;

      // Update constraints
      const constraintsPath = path.resolve(
        process.cwd(),
        `src/data/${contentDir}/clustering-constraints.json`,
      );
      try {
        let constraints: ClusteringConstraints = { disconnects: [], connects: [] };
        try {
          const data = await fsp.readFile(constraintsPath, "utf-8");
          constraints = JSON.parse(data);
        } catch (e) {}

        if (!constraints.disconnects) constraints.disconnects = [];
        if (!constraints.connects) constraints.connects = [];

        for (const id of imageIds) {
          // Disconnect from source, Connect to target
          constraints.disconnects.push({ imageId: id, personId: sourcePersonId });
          constraints.connects.push({ imageId: id, personId: targetPersonId });
        }

        // De-duplicate constraints
        const uniqueD = new Set();
        constraints.disconnects = constraints.disconnects.filter((c) => {
          const key = `${c.imageId}:${c.personId}`;
          if (uniqueD.has(key)) return false;
          uniqueD.add(key);
          return true;
        });

        const uniqueC = new Set();
        constraints.connects = constraints.connects.filter((c) => {
          const key = `${c.imageId}:${c.personId}`;
          if (uniqueC.has(key)) return false;
          uniqueC.add(key);
          return true;
        });

        await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
      } catch (e) {
        console.warn("[REASSIGN] Failed to update constraints");
      }

      // Thumbnail logic cleanup if needed
      // If target had no thumbnail, give it one
      if (!targetPerson.thumbnail && movedCount > 0) {
        targetPerson.thumbnail = `faces/${targetPersonId}/${imageIds[0]}.jpg`;
      }

      // If source thumbnail was moved, find new one
      if (sourcePerson.thumbnail && imageIds.some((id) => sourcePerson.thumbnail.includes(id))) {
        try {
          const files = await fsp.readdir(sourceDir);
          const valid = files.filter((f) => f.endsWith(".jpg") && !f.startsWith("."));
          if (valid.length > 0) {
            sourcePerson.thumbnail = `faces/${sourcePersonId}/${valid[0]}`;
          } else {
            sourcePerson.thumbnail = "";
          }
        } catch (e) {
          sourcePerson.thumbnail = "";
        }
      }

      await savePeopleManifest(dataDir, peopleManifest);
      await saveImagesManifest(dataDir, imagesManifest);
      await saveFacesManifest(dataDir, facesManifest);

      return json({ success: true, movedCount });
    });
  } catch (error) {
    console.error("[REASSIGN] Error:", error);
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError ? "Operation locked by another process" : "Internal Error",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

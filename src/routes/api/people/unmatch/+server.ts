import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import type { ImageEntry, ImageFaces } from "$lib/types/manifest";
import { validateUnmatchInput } from "$lib/utils/api-validators";
import { toSlug } from "$lib/utils/strings";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "../../../../../scripts/lib/manifest-repository";

const logger = createLogger("people-api");

export async function POST({ request }) {
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }
  const body = await request.json();
  const validation = validateUnmatchInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, imageIds: idsToUnmatch, ignore: shouldIgnore } = validation.data;

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

      const sourcePerson = peopleManifest.people.find((p) => p.id === personId);
      if (!sourcePerson) {
        return json({ success: false, error: "Person not found" }, { status: 404 });
      }

      const processedNewPeople = [];
      const idSet = new Set(idsToUnmatch);

      for (const id of idsToUnmatch) {
        const name = `Odpojeno z ${sourcePerson.name}`;
        const slug = toSlug(name);

        const uuid = crypto.randomUUID().slice(0, 8);
        const newPersonId = `person-${uuid}--${slug}`;

        const newPerson = {
          id: newPersonId,
          name,
          faceDescriptor: [],
          clusters: [],
          faceCount: 1,
          thumbnail: `faces/${newPersonId}/${id}.jpg`,
          ignored: shouldIgnore ?? false,
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          category: "person" as const, // Explicit category or default
        };

        peopleManifest.people.push(newPerson);
        processedNewPeople.push(newPerson);

        let imageUpdated = false;
        for (const day of imagesManifest.photoDays) {
          for (const item of day.items) {
            if (item.type === "image" && item.id === id) {
              const img = item as ImageEntry;
              if (img.people?.includes(personId)) {
                // Remove old person from main manifest
                img.people = img.people.filter((pid) => pid !== personId);
                // Add new person
                img.people.push(newPersonId);
                imageUpdated = true;
              }
            }
          }
        }

        // Also update faces manifest to satisfy Split & Link architecture
        if (Object.hasOwn(facesManifest, id)) {
          const faceData = facesManifest[id];
          if (faceData.peopleIds?.includes(personId)) {
            faceData.peopleIds = faceData.peopleIds.filter((pid: string) => pid !== personId);
            faceData.peopleIds.push(newPersonId);
            imageUpdated = true;
          }
        } else if (imageUpdated) {
          // If it was in the main manifest but not in faces.manifest,
          // we should probably initialize it in faces.manifest too if we want it to persist.
          const newFaceData: ImageFaces = {
            facesDetected: false,
            faces: [],
            peopleIds: [newPersonId],
          };
          facesManifest[id] = newFaceData;
        }

        if (!imageUpdated) {
          logger.warn(`[UNMATCH] Image ${id} or person link not found, skipping move`);
          continue;
        }

        const oldPath = path.resolve(facesDir, personId, `${id}.jpg`);
        const newDir = path.resolve(facesDir, newPersonId);
        const newPath = path.resolve(newDir, `${id}.jpg`);

        await fsp.mkdir(newDir, { recursive: true });

        try {
          await fsp.rename(oldPath, newPath);
        } catch (_e) {
          logger.warn(`[UNMATCH] File move failed: ${oldPath} -> ${newPath}`);
        }
      }

      sourcePerson.faceCount = Math.max(0, sourcePerson.faceCount - idsToUnmatch.length);

      if (sourcePerson.faceCount > 0) {
        const sourceDir = path.resolve(facesDir, personId);
        let needsNewThumbnail = false;

        if (
          !sourcePerson.thumbnail ||
          idsToUnmatch.some((id) => sourcePerson.thumbnail?.includes(id))
        ) {
          logger.debug(`[UNMATCH] Thumbnail matches one of removed images, invalidating...`);
          needsNewThumbnail = true;
        }

        if (!needsNewThumbnail && sourcePerson.thumbnail) {
          try {
            const thumbPath = path.resolve(
              process.cwd(),
              `static/${contentDir}`,
              sourcePerson.thumbnail,
            );
            await fsp.access(thumbPath);
          } catch {
            logger.debug(
              `[UNMATCH] Current thumbnail file not found: ${sourcePerson.thumbnail}, invalidating...`,
            );
            needsNewThumbnail = true;
          }
        }

        if (needsNewThumbnail) {
          logger.debug(`[UNMATCH] Searching for new thumbnail for ${sourcePerson.name}...`);
          try {
            const files = await fsp.readdir(sourceDir);
            const validImages = files
              .filter(
                (f) =>
                  f.endsWith(".jpg") && !idSet.has(f.replace(".jpg", "")) && !f.startsWith("."),
              )
              .sort();

            if (validImages.length > 0) {
              sourcePerson.thumbnail = `faces/${personId}/${validImages[0]}`;
            } else {
              sourcePerson.thumbnail = "";
            }
          } catch (_e) {
            sourcePerson.thumbnail = "";
          }
        }
      } else {
        sourcePerson.thumbnail = "";
      }

      await savePeopleManifest(dataDir, peopleManifest);
      await saveImagesManifest(dataDir, imagesManifest);
      await saveFacesManifest(dataDir, facesManifest);

      // Save Disconnection and Connection Constraints
      const constraintsPath = path.resolve(
        process.cwd(),
        `src/data/${contentDir}/clustering-constraints.json`,
      );
      try {
        interface Constraints {
          disconnects: { imageId: string; personId: string }[];
          connects: { imageId: string; personId: string }[];
        }
        let constraints: Constraints = { disconnects: [], connects: [] };
        try {
          const data = await fsp.readFile(constraintsPath, "utf-8");
          constraints = JSON.parse(data);
        } catch (_e) {}

        if (!constraints.disconnects) constraints.disconnects = [];
        if (!constraints.connects) constraints.connects = [];

        for (let i = 0; i < idsToUnmatch.length; i++) {
          const id = idsToUnmatch[i];
          const newPerson = processedNewPeople[i];
          const newPersonId = newPerson.id;

          constraints.disconnects.push({ imageId: id, personId: personId });
          constraints.connects.push({ imageId: id, personId: newPersonId });
        }

        await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
        logger.debug(`[UNMATCH] Updated clustering-constraints.json with disconnects and connects`);
      } catch (_e) {}

      return json({
        success: true,
        count: idsToUnmatch.length,
        newPerson: processedNewPeople[0], // Return the first new person for the test (test legacy)
        newPeople: processedNewPeople,
      });
    });
  } catch (error) {
    logger.error(`[UNMATCH] Error: ${error}`);
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError ? "Operation blocked by another process" : "Internal Error",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

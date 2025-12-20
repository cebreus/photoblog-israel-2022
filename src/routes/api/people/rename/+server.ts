import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";
import { validateRenameInput } from "$lib/utils/api-validators";
import { toSlug } from "$lib/utils/strings";
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

const logger = createLogger("people-api");

export async function POST({ request }) {
  const body = await request.json();
  const validation = validateRenameInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, name } = validation.data;

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

      const person = peopleManifest.people.find((p) => p.id === personId);

      if (!person) {
        return json({ success: false, error: "Person not found" }, { status: 404 });
      }

      person.name = name;

      const slug = toSlug(name);

      const baseIdMatch = personId.match(/^(person-[a-f0-9]+)/);
      const baseId = baseIdMatch ? baseIdMatch[1] : personId;

      const newId = `${baseId}--${slug}`;

      if (newId !== personId) {
        logger.info(`[RENAME] Changing ID: ${personId} -> ${newId}`);

        const oldPath = path.resolve(facesDir, personId);
        const newPath = path.resolve(facesDir, newId);
        let _folderRenamed = false;

        let sourceExists = false;
        try {
          await fsp.access(oldPath);
          sourceExists = true;
        } catch {
          logger.info(`[RENAME] Source folder doesn't exist, will be created by face-clustering`);
        }

        if (sourceExists) {
          try {
            await fsp.access(newPath);
            return json(
              {
                success: false,
                error: `Target folder already exists: ${newId}`,
              },
              { status: 409 },
            );
          } catch {}

          try {
            await fsp.rename(oldPath, newPath);
            _folderRenamed = true;
            logger.info(`[RENAME] Folder renamed successfully`);
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error(`[RENAME] Folder rename failed: ${errorMessage}`);
            return json(
              {
                success: false,
                error: `Failed to rename folder: ${errorMessage}`,
              },
              { status: 500 },
            );
          }
        }

        person.id = newId;

        let _updatedCount = 0;
        for (const day of imagesManifest.photoDays) {
          for (const item of day.items) {
            if (item.type === "image" && item.people?.includes(personId)) {
              item.people = item.people.map((id: string) => (id === personId ? newId : id));

              // Also update faces manifest
              const id = item.id;
              if (Object.hasOwn(facesManifest, id)) {
                const faceData = facesManifest[id];
                if (faceData.peopleIds?.includes(personId)) {
                  faceData.peopleIds = faceData.peopleIds.map((pid: string) =>
                    pid === personId ? newId : pid,
                  );
                }
              }

              _updatedCount++;
            }
          }
        }
        logger.info(`[RENAME] Updated ${_updatedCount} image references`);

        if (person.thumbnail?.includes(personId)) {
          person.thumbnail = person.thumbnail.replace(personId, newId);
        }

        const constraintsPath = path.resolve(
          process.cwd(),
          `src/data/${contentDir}/clustering-constraints.json`,
        );
        try {
          const data = await fsp.readFile(constraintsPath, "utf-8");
          const constraints = JSON.parse(data);
          if (constraints.disconnects) {
            let modified = false;
            constraints.disconnects.forEach((c: { personId: string }) => {
              if (c.personId === personId) {
                c.personId = newId;
                modified = true;
              }
            });
            if (modified) {
              await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
              logger.info("[RENAME] Updated constraints for new ID");
            }
          }
        } catch (_e) {}
      }

      await savePeopleManifest(dataDir, peopleManifest);
      await saveImagesManifest(dataDir, imagesManifest);
      await saveFacesManifest(dataDir, facesManifest);

      return json({ success: true, name: person.name, id: person.id });
    });
  } catch (error) {
    logger.error(`[RENAME] Error: ${error}`);
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError ? "Operation locked by another process" : "Failed to rename person",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

import type { Manifest, PeopleManifest } from "$lib/types/manifest";
import { validateRenameInput } from "$lib/utils/api-validators";
import { toSlug } from "$lib/utils/strings";
import { json } from "@sveltejs/kit";
import fsp from "node:fs/promises";
import path from "node:path";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";

export async function POST({ request }) {
  const body = await request.json();
  const validation = validateRenameInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, name } = validation.data;

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const peopleManifestPath = path.join(dataDir, "people.manifest.json");
  const imagesManifestPath = path.join(dataDir, "images.manifest.json");
  const facesDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);

  try {
    return await withManifestLock(dataDir, async () => {
      const peopleManifest: PeopleManifest = JSON.parse(
        await fsp.readFile(peopleManifestPath, "utf-8"),
      );
      const imagesManifest: Manifest = JSON.parse(await fsp.readFile(imagesManifestPath, "utf-8"));

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
        console.log(`[RENAME] Changing ID: ${personId} -> ${newId}`);

        const oldPath = path.resolve(facesDir, personId);
        const newPath = path.resolve(facesDir, newId);
        let _folderRenamed = false;

        let sourceExists = false;
        try {
          await fsp.access(oldPath);
          sourceExists = true;
        } catch {
          console.log(`[RENAME] Source folder doesn't exist, will be created by face-clustering`);
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
            console.log(`[RENAME] Folder renamed successfully`);
          } catch (e) {
            console.error(`[RENAME] Folder rename failed: ${(e as Error).message}`);
            return json(
              {
                success: false,
                error: `Failed to rename folder: ${(e as Error).message}`,
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
              _updatedCount++;
            }
          }
        }
        console.log(`[RENAME] Updated ${_updatedCount} image references`);

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
            constraints.disconnects.forEach((c: any) => {
              if (c.personId === personId) {
                c.personId = newId;
                modified = true;
              }
            });
            if (modified) {
              await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
              console.log("[RENAME] Updated constraints for new ID");
            }
          }
        } catch (_e) {}
      }

      await fsp.writeFile(peopleManifestPath, JSON.stringify(peopleManifest, null, 2));
      await fsp.writeFile(imagesManifestPath, JSON.stringify(imagesManifest, null, 2));

      return json({ success: true, name: person.name, id: person.id });
    });
  } catch (error) {
    console.error("[RENAME] Error:", error);
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError ? "Operace je blokována jiným procesem" : "Failed to rename person",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

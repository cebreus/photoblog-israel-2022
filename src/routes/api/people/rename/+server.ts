import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";
import type { Manifest, PeopleManifest } from "$lib/types/manifest";
import { toSlug } from "$lib/utils/strings";

export async function POST({ request }) {
  const { personId, name } = await request.json();

  if (!personId || !name) {
    return json({ success: false, error: "Missing personId or name" }, { status: 400 });
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
  const facesDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);

  try {
    // Load manifests
    const peopleManifest: PeopleManifest = JSON.parse(
      await fsp.readFile(peopleManifestPath, "utf-8"),
    );
    const imagesManifest: Manifest = JSON.parse(await fsp.readFile(imagesManifestPath, "utf-8"));

    const person = peopleManifest.people.find((p) => p.id === personId);

    if (!person) {
      return json({ success: false, error: "Person not found" }, { status: 404 });
    }

    // Update Name
    person.name = name;

    // Calculate New ID (slugified suffix)
    const slug = toSlug(name);

    // Extract base ID (person-HASH)
    // Supports formats: "person-HASH", "person-HASH--old-slug"
    // Regex matches "person-" followed by hexdigits/dashes until "--" or end
    const baseIdMatch = personId.match(/^(person-[a-f0-9]+)/);
    const baseId = baseIdMatch ? baseIdMatch[1] : personId; // Fallback to full ID if not standard pattern

    const newId = `${baseId}--${slug}`;

    if (newId !== personId) {
      console.log(`[RENAME] Changing ID: ${personId} -> ${newId}`);

      // 1. Rename Folder
      const oldPath = path.resolve(facesDir, personId);
      const newPath = path.resolve(facesDir, newId);

      try {
        await fsp.rename(oldPath, newPath);
      } catch (e) {
        console.warn(
          `[RENAME] Could not rename folder (might not exist): ${oldPath} -> ${newPath}`,
        );
        // Consider creating new dir if missing? No, face-clustering handles creation.
      }

      // 2. Update Person ID in People Manifest
      person.id = newId;

      // 3. Update references in Images Manifest
      let updatedCount = 0;
      for (const day of imagesManifest.photoDays) {
        for (const item of day.items) {
          if (item.type === "image" && item.people?.includes(personId)) {
            item.people = item.people.map((id: string) => (id === personId ? newId : id));
            updatedCount++;
          }
        }
      }
      console.log(`[RENAME] Updated ${updatedCount} image references`);

      // Update thumbnail path if it contains the ID
      if (person.thumbnail && person.thumbnail.includes(personId)) {
        person.thumbnail = person.thumbnail.replace(personId, newId);
      }

      // Update Constraints (if any)
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
      } catch (e) {
        // Ignore
      }
    }

    // Save manifests
    await fsp.writeFile(peopleManifestPath, JSON.stringify(peopleManifest, null, 2));
    await fsp.writeFile(imagesManifestPath, JSON.stringify(imagesManifest, null, 2));

    return json({ success: true, name: person.name, id: person.id });
  } catch (error) {
    console.error("Error renaming person:", error);
    return json({ success: false, error: "Failed to rename person" }, { status: 500 });
  }
}

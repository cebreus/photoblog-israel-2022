import type { PeopleManifest } from "$lib/types/manifest";
import { json } from "@sveltejs/kit";
import fsp from "node:fs/promises";
import path from "node:path";

export async function POST({ request }) {
  const { personId, personIds } = await request.json();

  if (!personId && (!personIds || !Array.isArray(personIds) || personIds.length === 0)) {
    return json({ success: false, error: "Missing personId or personIds" }, { status: 400 });
  }

  const targets = personIds || [personId];
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const manifestPath = path.resolve(process.cwd(), `src/data/${contentDir}/people.manifest.json`);

  try {
    const content = await fsp.readFile(manifestPath, "utf-8");
    const manifest: PeopleManifest = JSON.parse(content);

    let changed = false;
    const results = [];

    for (const id of targets) {
      const person = manifest.people.find((p) => p.id === id);
      if (person) {
        // If bulk (personIds provided), we assume we want to IGNORE them (set to true).
        // If single (personId provided), we toggle (legacy behavior).
        // However, the frontend bulk action logic was "Ignore", so setting to true is safer for bulk.
        // But the previous implementation toggled.
        // Let's stick to TOGGLE for single 'personId' and SET TRUE for 'personIds' (bulk ignore).
        // Wait, the previous frontend code called it for "Ignoring".
        // Use logic: if personIds -> force true? Or just toggle?
        // Bulk ignore usually implies "Hide these".
        // Let's enable "set to true" for bulk to be deterministic.
        
        if (personIds) {
            if (!person.ignored) {
                person.ignored = true;
                changed = true;
            }
        } else {
            // Toggle for single ID (legacy)
            person.ignored = !person.ignored;
            changed = true;
        }
        results.push({ id, ignored: person.ignored });
      } else {
        results.push({ id, error: "Not found" });
      }
    }

    if (changed) {
      await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    }

    return json({ success: true, results });
  } catch (error) {
    console.error("Error updating ignore state:", error);
    return json({ success: false, error: "Failed to update ignore state" }, { status: 500 });
  }
}

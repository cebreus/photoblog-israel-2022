import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";
import type { PeopleManifest } from "$lib/types/manifest";

export async function POST({ request }) {
  const { personId } = await request.json();

  if (!personId) {
    return json({ success: false, error: "Missing personId" }, { status: 400 });
  }

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const manifestPath = path.resolve(process.cwd(), `src/data/${contentDir}/people.manifest.json`);

  try {
    const content = await fsp.readFile(manifestPath, "utf-8");
    const manifest: PeopleManifest = JSON.parse(content);

    const person = manifest.people.find((p) => p.id === personId);

    if (!person) {
      return json({ success: false, error: "Person not found" }, { status: 404 });
    }

    // Toggle ignored state
    person.ignored = !person.ignored;

    await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    return json({ success: true, ignored: person.ignored });
  } catch (error) {
    console.error("Error toggling ignore state:", error);
    return json({ success: false, error: "Failed to toggle ignore state" }, { status: 500 });
  }
}

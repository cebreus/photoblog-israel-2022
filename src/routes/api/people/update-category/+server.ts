import path from "node:path";
import { json } from "@sveltejs/kit";
import { validateUpdateCategoryInput } from "$lib/utils/api-validators";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";
import {
  loadPeopleManifest,
  savePeopleManifest,
} from "../../../../../scripts/lib/manifest-repository";

export async function POST({ request }) {
  const body = await request.json();
  const validation = validateUpdateCategoryInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, category } = validation.data;

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);

  try {
    return await withManifestLock(dataDir, async () => {
      const manifest = await loadPeopleManifest(dataDir);
      if (!manifest) {
        return json({ success: false, error: "People manifest not found" }, { status: 500 });
      }

      const person = manifest.people.find((p) => p.id === personId);
      if (!person) {
        return json({ success: false, error: "Osoba nebyla nalezena" }, { status: 404 });
      }

      person.category = category;
      await savePeopleManifest(dataDir, manifest);

      return json({ success: true, category: person.category });
    });
  } catch (error) {
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError ? "Operace je blokována jiným procesem" : "Failed to update category",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

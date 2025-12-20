import path from "node:path";
import { json } from "@sveltejs/kit";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";
import {
  loadPeopleManifest,
  savePeopleManifest,
} from "../../../../../scripts/lib/manifest-repository";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function POST({ request }) {
  const body = await request.json();

  const { personId, personIds } = body as Record<string, unknown>;

  let targets: string[];
  if (personIds !== undefined) {
    if (!isStringArray(personIds) || personIds.length === 0) {
      return json(
        { success: false, error: "personIds must be a non-empty array" },
        { status: 400 },
      );
    }
    targets = personIds;
  } else if (isNonEmptyString(personId)) {
    targets = [personId];
  } else {
    return json(
      { success: false, error: "Either personId or personIds must be provided" },
      { status: 400 },
    );
  }

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const _manifestPath = path.join(dataDir, "people.manifest.json");

  try {
    return await withManifestLock(dataDir, async () => {
      const manifest = await loadPeopleManifest(dataDir);
      if (!manifest) {
        return json({ success: false, error: "People manifest not found" }, { status: 500 });
      }

      let changed = false;
      const results = [];

      for (const id of targets) {
        const person = manifest.people.find((p) => p.id === id);
        if (person) {
          // Bulk = force true, single = toggle
          if (targets.length > 1) {
            if (!person.ignored) {
              person.ignored = true;
              changed = true;
            }
          } else {
            person.ignored = !person.ignored;
            changed = true;
          }
          results.push({ id, ignored: person.ignored });
        } else {
          results.push({ id, error: "Not found" });
        }
      }

      if (changed) {
        await savePeopleManifest(dataDir, manifest);
      }

      return json({ success: true, results });
    });
  } catch (error) {
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError
          ? "Operation locked by another process"
          : "Failed to update ignore state",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

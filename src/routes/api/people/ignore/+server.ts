import type { PeopleManifest } from "$lib/types/manifest";
import { json } from "@sveltejs/kit";
import fsp from "node:fs/promises";
import path from "node:path";
import { withManifestLock } from "../../../../../scripts/lib/manifest-lock";

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
      return json({ success: false, error: "personIds musí být neprázdné pole" }, { status: 400 });
    }
    targets = personIds;
  } else if (isNonEmptyString(personId)) {
    targets = [personId];
  } else {
    return json(
      { success: false, error: "Musí být zadán personId nebo personIds" },
      { status: 400 },
    );
  }

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const manifestPath = path.join(dataDir, "people.manifest.json");

  try {
    return await withManifestLock(dataDir, async () => {
      const content = await fsp.readFile(manifestPath, "utf-8");
      const manifest: PeopleManifest = JSON.parse(content);

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
        await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }

      return json({ success: true, results });
    });
  } catch (error) {
    console.error("[IGNORE] Error:", error);
    const isLockError = error instanceof Error && error.message.includes("lock");
    return json(
      {
        success: false,
        error: isLockError
          ? "Operace je blokována jiným procesem"
          : "Failed to update ignore state",
      },
      { status: isLockError ? 503 : 500 },
    );
  }
}

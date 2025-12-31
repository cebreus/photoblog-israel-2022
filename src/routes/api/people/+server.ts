import path from "node:path";
import process from "node:process";
import { json, type RequestHandler } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import { reloadManifests } from "$lib/utils/images";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import { loadPeopleManifest, savePeopleManifest } from "$scripts/lib/manifests/repository";

const logger = createLogger("api:people");

interface PersonUpdate {
  id: string;
  name?: string;
  hidden?: boolean;
  junk?: boolean;
  category?: "person" | "statue" | "painting";
}

export const PATCH: RequestHandler = async ({ request }) => {
  if (!dev) {
    return json({ error: "Read-only mode in production" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = body.updates as PersonUpdate[];

    if (!Array.isArray(updates) || updates.length === 0) {
      return json({ error: "Invalid request: 'updates' array is required" }, { status: 400 });
    }

    const contentDir = process.env.CONTENT_DIR || "egypt-2025";
    const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

    let updatedCount = 0;
    const results: { id: string; success: boolean; error?: string }[] = [];

    await withManifestLock(dataDir, async () => {
      const manifest = await loadPeopleManifest(dataDir);
      if (!manifest) {
        throw new Error("Manifest not found");
      }

      for (const update of updates) {
        const person = manifest.people.find((p) => p.id === update.id);

        if (!person) {
          results.push({ id: update.id, success: false, error: "Person not found" });
          continue;
        }

        // Apply updates
        if (update.name !== undefined) {
          const newName = update.name.trim();
          if (newName.length > 0) {
            person.name = newName;
          }
        }

        if (update.hidden !== undefined) person.hidden = update.hidden;
        if (update.junk !== undefined) person.junk = update.junk;
        if (update.category !== undefined) {
          if (["person", "statue", "painting"].includes(update.category)) {
            person.category = update.category;
          }
        }

        updatedCount++;
        results.push({ id: update.id, success: true });
      }

      if (updatedCount > 0) {
        await savePeopleManifest(dataDir, manifest);
      }
    });

    // Force reload of in-memory manifest cache
    await reloadManifests();

    return json({
      success: true,
      updated: updatedCount,
      results,
    });
  } catch (err) {
    logger.error("Error processing people updates:", err);
    return json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
};

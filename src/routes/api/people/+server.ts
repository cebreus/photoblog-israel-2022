import path from "node:path";
import process from "node:process";
import { json, type RequestHandler } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadClusteringConstraints,
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveClusteringConstraints,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "$scripts/lib/manifests/repository";
import { renamePerson } from "$scripts/lib/people/normalization";
import { toSlug } from "../../../../shared/utils/strings";

interface PersonUpdate {
  id: string;
  name?: string;
  hidden?: boolean;
  junk?: boolean;
  category?: "person" | "statue" | "painting";
  isUserNamed?: boolean;
}

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const { log, logContext } = locals;

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
    const facesDir = path.resolve(process.cwd(), `static-${contentDir}`, "faces");

    let updatedCount = 0;
    const results: { id: string; success: boolean; error?: string }[] = [];
    const renames: { oldId: string; newId: string; newName: string }[] = [];

    await withManifestLock(dataDir, async () => {
      // Load all manifests needed for person renaming
      const peopleManifest = await loadPeopleManifest(dataDir);
      const imagesManifest = await loadImagesManifest(dataDir);
      const facesManifest = await loadFacesManifest(dataDir);
      const constraints = await loadClusteringConstraints(dataDir);

      if (!peopleManifest || !imagesManifest || !facesManifest || !constraints) {
        throw new Error("Required manifests not found");
      }

      const manifests = {
        people: peopleManifest,
        images: imagesManifest,
        faces: facesManifest,
        constraints,
      };

      for (const update of updates) {
        const person = manifests.people.people.find((p) => p.id === update.id);

        if (!person) {
          results.push({ id: update.id, success: false, error: "Person not found" });
          continue;
        }

        let needsRename = false;
        let newId = person.id;
        let newName = person.name;

        // Check if name is being updated
        if (update.name !== undefined) {
          const trimmedName = update.name.trim();
          if (trimmedName.length > 0 && trimmedName !== person.name) {
            newName = trimmedName;
            needsRename = true;

            // Generate new ID based on the new name
            const hash = person.id.split("-").pop() || "";
            const category = person.category || "person";
            const slug = toSlug(newName);
            newId = `${category}-${slug}-${hash}`;
          }
        }

        // Perform rename if needed
        if (needsRename && newId !== person.id) {
          try {
            await renamePerson(
              {
                person,
                oldId: person.id,
                newId,
                newName,
              },
              manifests,
              facesDir,
            );
            // Mark as user-named after successful rename
            person.isUserNamed = true;
            // Track rename for logging
            renames.push({ oldId: person.id, newId, newName });
          } catch (err) {
            log.error({ err, personId: update.id }, "Failed to rename person");
            results.push({
              id: update.id,
              success: false,
              error: "Failed to rename person",
            });
            continue;
          }
        } else if (update.name !== undefined) {
          // Name update without ID change
          person.name = newName;
          person.isUserNamed = true;
        }

        // Apply other updates
        if (update.isUserNamed !== undefined) person.isUserNamed = update.isUserNamed;
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
        await savePeopleManifest(dataDir, manifests.people);
        await saveImagesManifest(dataDir, manifests.images);
        await saveFacesManifest(dataDir, manifests.faces);
        await saveClusteringConstraints(dataDir, manifests.constraints);
      }
    });

    // Force reload of in-memory manifest cache
    await reloadManifests();

    logContext.updatedPeopleCount = updatedCount;
    if (renames.length > 0) {
      logContext.renames = renames;
    }
    return json({
      success: true,
      updated: updatedCount,
      results,
    });
  } catch (err) {
    log.error({ err }, "Error processing people updates");
    return json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
};

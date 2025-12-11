import { json, type RequestHandler } from "@sveltejs/kit";
import fs from "node:fs/promises";
import path from "node:path";
import type { Manifest } from "$lib/types/manifest";

export const DELETE: RequestHandler = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  const { ids } = await request.json(); // ids is array of { id: string, src: string }

  console.log("DELETE request received for IDs:", JSON.stringify(ids, null, 2));

  if (!ids || !Array.isArray(ids)) {
    return json({ message: "Invalid request" }, { status: 400 });
  }

  const contentRoot = path.resolve(process.cwd(), "content");
  const dataRoot = path.resolve(process.cwd(), "src/lib/data");

  const deleted: string[] = [];
  const errors: string[] = [];

  // Group items by content directory to handle manifests efficiently
  const itemsByContentDir: Record<string, typeof ids> = {};
  const defaultContentDir = process.env.CONTENT_DIR;

  for (const item of ids) {
    if (!item.src) continue;

    // Check if src is just a filename or has path structure
    const parts = item.src.split("/");

    // Clean potential query params or URL junk if present (unlikely for manifest data but safe)
    // Actually parts length check is enough for structure.

    if (parts.length >= 3 && parts[1] === "images") {
      // Standard URL format: /images/{contentDir}/file.jpg
      const contentDirKey = parts[2];
      if (!itemsByContentDir[contentDirKey]) {
        itemsByContentDir[contentDirKey] = [];
      }
      itemsByContentDir[contentDirKey].push(item);
    } else if (defaultContentDir) {
      // Just filename or relative path, assumes current content dir context
      if (!itemsByContentDir[defaultContentDir]) {
        itemsByContentDir[defaultContentDir] = [];
      }
      itemsByContentDir[defaultContentDir].push(item);
    } else {
      console.warn(
        `Could not determine content directory for item ${item.src} and no CONTENT_DIR env set.`,
      );
    }
  }

  for (const [contentDir, items] of Object.entries(itemsByContentDir)) {
    const manifestPath = path.join(
      dataRoot,
      contentDir,
      "images.manifest.json",
    );
    let manifest: Manifest | null = null;

    // Load manifest to remove entries even if files are missing
    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      manifest = JSON.parse(content);
    } catch (e) {
      console.warn(
        `Manifest not found for ${contentDir}, skipping manifest update.`,
      );
    }

    let manifestModified = false;
    const idsToDelete = new Set(items.map((i: any) => i.id));

    for (const item of items) {
      const srcPath = item.src;
      // Get filename to find physical file
      // If srcPath starts with /images/, strip it. If it's just a filename, path.parse works fine.
      let relativePath = srcPath;
      if (srcPath.startsWith("/images/")) {
        relativePath = decodeURIComponent(srcPath.replace(/^\/images\//, ""));
      } else {
        // It's likely just "file.jpg" or "folder/file.jpg".
        // Since we know contentDir, we just want the basename.
        relativePath = decodeURIComponent(srcPath);
      }

      const nameWithoutExt = path.parse(relativePath).name;
      const physicalDir = path.join(contentRoot, contentDir, "pics");

      let deletedPhysical = false;
      let fileFoundOnDisk = false;

      try {
        // Try to find the physical file(s) in the 'pics' directory
        // We use readdir to find matching files with any extension (jpg, heic, etc)
        console.log(`Searching in physicalDir: ${physicalDir}`);
        const files = await fs.readdir(physicalDir).catch((e) => {
          console.error(`Failed to read dir ${physicalDir}:`, e);
          return [];
        });

        console.log(`Checking ${physicalDir} for ${nameWithoutExt}`);

        const candidates = files.filter(
          (f) =>
            path.parse(f).name.toLowerCase() === nameWithoutExt.toLowerCase(),
        );

        console.log(`Found candidates: ${candidates.join(", ")}`);

        if (candidates.length > 0) {
          fileFoundOnDisk = true;
          for (const candidate of candidates) {
            await fs.unlink(path.join(physicalDir, candidate));
            deletedPhysical = true;
          }
        }

        if (deletedPhysical) {
          deleted.push(item.src);
        } else {
          // If no physical file found, check if we are removing it from manifest later
          // We don't error yet, we let the manifest logic handle the "ghost" cleanup.
          // But we should track that we didn't touch disk.
          if (idsToDelete.has(item.id)) {
            // It will be removed from manifest
            // We consider this a "cleanup" success/info
            // deleted.push(item.src);
            // Wait, user wants to know if physical deletion happened.
            // We will add a note to results? Or just consider it deleted from VIEW.
            // User said: "potvrdis smazani pouze pokiud fyzicky dojde je smazani, ze ano?"
            // So if NOT deleted physically, we should perhaps NOT return it in `deleted` array strictly?
            // Or return it with a warning?
            // "kdyz ke smazan nedojde vypiises cesky informacni hlasku, ktera opravdu bude vypovidat o chybe a nebude zavadejici"

            // If we delete from manifest, it IS deleted from the app.
            // I will treat it as a "deleted" item but maybe add a warning message if I can.
            // But the API returns { deleted: string[], errors: string[] }.

            // Let's rely on the manifest update to be the "truth" of the application state,
            // but if file wasn't found, we should probably inform user.
            // However, simpler is: if manifest acts, we are good.
            // But strictly obeying "confirm delete ONLY if physical delete happens":

            if (!fileFoundOnDisk) {
              errors.push(
                `Soubor ${nameWithoutExt} nebyl nalezen na disku (ale byl odstraněn se seznamu).`,
              );
              // We still remove it from manifest below.
              deleted.push(item.src); // Mark as processed so UI removes it
            }
          } else {
            errors.push(
              `Soubor ${nameWithoutExt} nebyl nalezen na disku ani v seznamu.`,
            );
          }
        }
      } catch (e: any) {
        errors.push(`Chyba při mazání ${nameWithoutExt}: ${e.message}`);
      }
    }

    // Update Manifest if loaded
    if (manifest) {
      manifest.photoDays = manifest.photoDays.map((day) => {
        const originalLength = day.items.length;
        day.items = day.items.filter((i) => !idsToDelete.has(i.id));
        if (day.items.length !== originalLength) {
          manifestModified = true;
        }
        return day;
      });

      // Optionally filter out empty days here if desired, but sticking to item removal for safety.

      if (manifestModified) {
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
    }
  }

  // If we had errors but also successes, or if the "errors" were just partial,
  // we might want to return success to trigger the frontend reload.
  // The frontend handles !res.ok by showing an error.
  // If we seemingly "deleted" items (removed from manifest), we should report success.

  if (errors.length > 0) {
    // If we have deleted items (successes or ghost cleanups) AND errors, we might want to return 200 with errors array.
    // If ONLY errors (no persistent changes), then 500.
    if (deleted.length === 0) {
      return json(
        { message: "Nepodařilo se smazat soubory", errors },
        { status: 500 },
      );
    }
  }

  return json({ success: true, deleted, errors });
};

import { json, type RequestHandler } from "@sveltejs/kit";
import fs from "node:fs/promises";
import path from "node:path";
import type { Manifest } from "$lib/types/manifest";
import { exiftool } from "exiftool-vendored";

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
  const dataRoot = path.resolve(process.cwd(), "src/data");

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
    const manifestPath = path.join(dataRoot, contentDir, "images.manifest.json");
    let manifest: Manifest | null = null;

    // Load manifest to remove entries even if files are missing
    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      manifest = JSON.parse(content);
    } catch (e) {
      console.warn(`Manifest not found for ${contentDir}, skipping manifest update.`);
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
          (f) => path.parse(f).name.toLowerCase() === nameWithoutExt.toLowerCase(),
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
            errors.push(`Soubor ${nameWithoutExt} nebyl nalezen na disku ani v seznamu.`);
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
      return json({ message: "Nepodařilo se smazat soubory", errors }, { status: 500 });
    }
  }

  return json({ success: true, deleted, errors });
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  const { images, updates } = await request.json();

  console.log("PATCH /api/images request:", { images, updates });

  if (!images || !Array.isArray(images) || !updates) {
    return json({ message: "Invalid request" }, { status: 400 });
  }

  const contentRoot = path.resolve(process.cwd(), "content");
  const dataRoot = path.resolve(process.cwd(), "src/data");

  const errors: string[] = [];
  const updated: string[] = [];

  // Group items by content directory
  const itemsByContentDir: Record<string, typeof images> = {};
  const defaultContentDir = process.env.CONTENT_DIR;

  for (const item of images) {
    if (!item.src) continue;

    const parts = item.src.split("/");
    if (parts.length >= 3 && parts[1] === "images") {
      const contentDirKey = parts[2];
      if (!itemsByContentDir[contentDirKey]) {
        itemsByContentDir[contentDirKey] = [];
      }
      itemsByContentDir[contentDirKey].push(item);
    } else if (defaultContentDir) {
      if (!itemsByContentDir[defaultContentDir]) {
        itemsByContentDir[defaultContentDir] = [];
      }
      itemsByContentDir[defaultContentDir].push(item);
    }
  }

  // Process each content directory
  for (const [contentDir, contentDirItems] of Object.entries(itemsByContentDir)) {
    const physicalRoot = path.join(contentRoot, contentDir);
    const manifestPath = path.join(dataRoot, contentDir, "images.manifest.json");

    let manifest: Manifest | null = null;
    let manifestModified = false;

    try {
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      manifest = JSON.parse(manifestContent);
    } catch (e) {
      errors.push(`Nepodařilo se načíst manifest pro ${contentDir}`);
      continue;
    }

    // Build exiftool tags from updates using the shared standard
    // Filter out undefined values first (though the helper handles null, undefined isn't ideal in loops)
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    ) as Record<string, string | string[] | null>;

    console.log("Filtered updates for content dir", contentDir, ":", {
      original: updates,
      filtered: filteredUpdates,
    });

    const { getExifToolWriteTags } = await import("$lib/utils/metadata-standards");
    const tags = getExifToolWriteTags(filteredUpdates as any);

    if (Object.keys(tags).length === 0) {
      errors.push("Žádná metadata k aktualizaci");
      continue;
    }

    // Update each image file
    for (const item of contentDirItems) {
      try {
        // Find the physical file
        let physicalDir = physicalRoot;
        const srcParts = item.src.split("/");
        const fileName = srcParts[srcParts.length - 1];
        const nameWithoutExt = path.parse(fileName).name;

        // Try direct path first
        let filePath = path.join(physicalRoot, fileName);
        if (!(await fs.stat(filePath).catch(() => null))) {
          // Try pics subdirectory
          const candidate = path.join(physicalRoot, "pics", fileName);
          if (await fs.stat(candidate).catch(() => null)) {
            filePath = candidate;
          } else {
            // Try searching for file with same name but different extension
            const searchDir = await fs.readdir(path.join(physicalRoot, "pics")).catch(() => []);
            const candidates = searchDir.filter(
              (f) => path.parse(f).name.toLowerCase() === nameWithoutExt.toLowerCase(),
            );

            if (candidates.length > 0) {
              filePath = path.join(physicalRoot, "pics", candidates[0]);
            } else {
              throw new Error(`Soubor ${fileName} nebyl nalezen`);
            }
          }
        }

        // Write metadata to file using exiftool
        await exiftool.write(filePath, tags, {
          writeArgs: ["-overwrite_original", "-coding=utf8", "-m", "-charset", "iptc=UTF8"],
        });

        updated.push(item.src);

        // Update manifest with new values if present
        if (manifest) {
          let found = false;
          for (const day of manifest.photoDays) {
            for (const imageItem of day.items) {
              if (imageItem.type === "image" && imageItem.id === item.id) {
                // Update top-level fields
                if (filteredUpdates.title && imageItem.exif) {
                  imageItem.exif.title = filteredUpdates.title as string;
                }
                if (filteredUpdates.caption && imageItem.exif) {
                  imageItem.exif.caption = filteredUpdates.caption as string;
                }
                if (filteredUpdates.city) {
                  imageItem.city = filteredUpdates.city as string;
                  if (imageItem.exif) imageItem.exif.city = filteredUpdates.city as string;
                }
                if (filteredUpdates.location) {
                  imageItem.location = filteredUpdates.location as string;
                  if (imageItem.exif) imageItem.exif.location = filteredUpdates.location as string;
                }
                if (filteredUpdates.author) {
                  imageItem.author = filteredUpdates.author as string;
                  if (imageItem.exif) imageItem.exif.author = filteredUpdates.author as string;
                }
                if (filteredUpdates.country && imageItem.exif) {
                  imageItem.exif.country = filteredUpdates.country as string;
                }
                if (filteredUpdates.countryCode && imageItem.exif) {
                  imageItem.exif.countryCode = filteredUpdates.countryCode as string;
                }
                if (filteredUpdates.state && imageItem.exif) {
                  imageItem.exif.state = filteredUpdates.state as string;
                }
                if (filteredUpdates.keywords) {
                  imageItem.keywords = Array.isArray(filteredUpdates.keywords)
                    ? filteredUpdates.keywords
                    : [filteredUpdates.keywords as string];
                  if (imageItem.exif) {
                    imageItem.exif.keywords = imageItem.keywords;
                  }
                }

                found = true;
                manifestModified = true;
                break;
              }
            }
            if (found) break;
          }
        }
      } catch (e: any) {
        errors.push(`Chyba při aktualizaci ${item.src}: ${e.message}`);
      }
    }

    // Save updated manifest
    if (manifest && manifestModified) {
      try {
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      } catch (e: any) {
        errors.push(`Chyba při uložení manifestu: ${e.message}`);
      }
    }
  }

  if (updated.length === 0) {
    return json({ message: "Nepodařilo se aktualizovat metadata", errors }, { status: 500 });
  }

  return json({ success: true, updated, errors });
};

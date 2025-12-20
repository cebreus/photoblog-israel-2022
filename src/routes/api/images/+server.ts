import { dev } from "$app/environment";
import type { Manifest } from "$lib/types/manifest";
import { json, type RequestHandler } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../../../scripts/config";
import {
  deleteGeneratedAssets,
  getOutputFolders,
  removeFromCache,
  removeImageFromConstraints,
} from "../../../../scripts/lib/cleanup-utils";
import { createLogger } from "../../../../scripts/lib/logger";

const logger = createLogger("api:images");

export const DELETE: RequestHandler = async ({ request }) => {
  if (!dev) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  const { ids } = await request.json();

  logger.info("DELETE request received for IDs:", JSON.stringify(ids, null, 2));

  if (!ids || !Array.isArray(ids)) {
    return json({ message: "Invalid request" }, { status: 400 });
  }

  const contentRoot = path.resolve(process.cwd(), "content");
  const dataRoot = path.resolve(process.cwd(), "src/data");
  const staticRoot = path.resolve(process.cwd(), "static");
  const tempRoot = path.resolve(process.cwd(), ".temp");

  const outputFolders = getOutputFolders({
    outputs: config.outputs,
    formats: config.encoding.formats,
  });

  const deleted: string[] = [];
  const errors: string[] = [];

  const itemsByContentDir: Record<string, typeof ids> = {};
  const defaultContentDir = process.env.CONTENT_DIR;

  for (const item of ids) {
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
    } else {
      logger.warn(
        `Could not determine content directory for item ${item.src} and no CONTENT_DIR env set.`,
      );
    }
  }

  for (const [contentDir, items] of Object.entries(itemsByContentDir)) {
    const manifestPath = path.join(dataRoot, contentDir, "images.manifest.json");
    let manifest: Manifest | null = null;

    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      manifest = JSON.parse(content);
    } catch (e) {
      logger.warn(`Manifest not found for ${contentDir}, skipping manifest update.`);
    }

    let manifestModified = false;
    const idsToDelete = new Set(items.map((i: any) => i.id));

    for (const item of items) {
      const srcPath = item.src;
      let relativePath = srcPath;
      if (srcPath.startsWith("/images/")) {
        relativePath = decodeURIComponent(srcPath.replace(/^\/images\//, ""));
      } else {
        relativePath = decodeURIComponent(srcPath);
      }

      const nameWithoutExt = path.parse(relativePath).name;
      const physicalDir = path.join(contentRoot, contentDir, "pics");

      let deletedPhysical = false;
      let fileFoundOnDisk = false;

      try {
        logger.verbose(`Searching in physicalDir: ${physicalDir}`);
        const files = await fs.readdir(physicalDir).catch((e) => {
          logger.error(`Failed to read dir ${physicalDir}:`, e);
          return [];
        });

        logger.verbose(`Checking ${physicalDir} for ${nameWithoutExt}`);

        const candidates = files.filter(
          (f) => path.parse(f).name.toLowerCase() === nameWithoutExt.toLowerCase(),
        );

        logger.verbose(`Found candidates: ${candidates.join(", ")}`);

        if (candidates.length > 0) {
          fileFoundOnDisk = true;
          for (const candidate of candidates) {
            await fs.unlink(path.join(physicalDir, candidate));
            deletedPhysical = true;
          }

          // Clean up generated assets
          const outputRoot = path.join(staticRoot, contentDir, "images");
          const assetCleanup = await deleteGeneratedAssets(
            nameWithoutExt,
            outputRoot,
            outputFolders,
          );
          if (assetCleanup.deleted.length > 0) {
            logger.info(
              `[DELETE] Removed ${assetCleanup.deleted.length} generated assets for ${nameWithoutExt}`,
            );
          }

          // Clean up cache
          const cachePath = path.join(tempRoot, contentDir, "images.cache.json");
          await removeFromCache(cachePath, `${nameWithoutExt}.heic`);
          await removeFromCache(cachePath, `${nameWithoutExt}.jpg`);

          // Clean up constraints
          const constraintsPath = path.join(dataRoot, contentDir, "clustering-constraints.json");
          const constraintCleanup = await removeImageFromConstraints(constraintsPath, item.id);
          if (constraintCleanup.disconnectsRemoved > 0 || constraintCleanup.connectsRemoved > 0) {
            logger.info(`[DELETE] Cleaned constraints for ${item.id}`);
          }
        }

        if (deletedPhysical) {
          deleted.push(item.src);
        } else {
          if (idsToDelete.has(item.id)) {
            if (!fileFoundOnDisk) {
              errors.push(
                `Soubor ${nameWithoutExt} nebyl nalezen na disku (ale byl odstraněn se seznamu).`,
              );
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

    if (manifest) {
      manifest.photoDays = manifest.photoDays.map((day) => {
        const originalLength = day.items.length;
        day.items = day.items.filter((i) => !idsToDelete.has(i.id));
        if (day.items.length !== originalLength) {
          manifestModified = true;
        }
        return day;
      });

      if (manifestModified) {
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
    }
  }

  if (errors.length > 0) {
    if (deleted.length === 0) {
      return json({ message: "Nepodařilo se smazat soubory", errors }, { status: 500 });
    }
  }

  return json({ success: true, deleted, errors });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  const { ids, action } = await request.json();

  if (action !== "archive") {
    return json({ message: "Invalid action" }, { status: 400 });
  }

  if (!ids || !Array.isArray(ids)) {
    return json({ message: "Invalid request" }, { status: 400 });
  }

  const contentRoot = path.resolve(process.cwd(), "content");
  const dataRoot = path.resolve(process.cwd(), "src/data");

  const archived: string[] = [];
  const errors: string[] = [];

  interface ArchiveItem {
    id: string;
    src: string;
    [key: string]: unknown;
  }
  const itemsByContentDir: Record<string, ArchiveItem[]> = {};
  const defaultContentDir = process.env.CONTENT_DIR;

  for (const item of ids as ArchiveItem[]) {
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

  for (const [contentDir, items] of Object.entries(itemsByContentDir)) {
    const manifestPath = path.join(dataRoot, contentDir, "images.manifest.json");
    const physicalPicsDir = path.join(contentRoot, contentDir, "pics");
    const archiveDir = path.join(contentRoot, contentDir, "archive");

    try {
      await fs.mkdir(archiveDir, { recursive: true });
    } catch (e: any) {
      errors.push(`Could not create archive directory for ${contentDir}: ${e.message}`);
      continue;
    }

    let manifest: Manifest | null = null;
    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      manifest = JSON.parse(content);
    } catch (e) {
      logger.warn(`Manifest not found for ${contentDir}`);
    }

    let manifestModified = false;
    const idsToArchive = new Set(items.map((i) => i.id));

    for (const item of items) {
      const srcPath = item.src;
      let relativePath = srcPath;
      if (srcPath.startsWith("/images/")) {
        relativePath = decodeURIComponent(srcPath.replace(/^\/images\//, ""));
      } else {
        relativePath = decodeURIComponent(srcPath);
      }

      const nameWithoutExt = path.parse(relativePath).name;

      try {
        const files = await fs.readdir(physicalPicsDir).catch(() => []);
        const candidates = files.filter(
          (f) => path.parse(f).name.toLowerCase() === nameWithoutExt.toLowerCase(),
        );

        if (candidates.length > 0) {
          for (const candidate of candidates) {
            const oldPath = path.join(physicalPicsDir, candidate);
            const newPath = path.join(archiveDir, candidate);
            await fs.rename(oldPath, newPath);
          }
          archived.push(item.src);

          const staticOutputRoot = path.join(process.cwd(), "static", contentDir, "images");
          const assetCleanup = await deleteGeneratedAssets(nameWithoutExt, staticOutputRoot, [
            "previews",
            "previews-webp",
            "previews-avif",
            "previews-xl",
            "previews-xl-webp",
            "previews-xl-avif",
            "details",
            "previews-xxs",
            "blurs",
          ]);
          if (assetCleanup.deleted.length > 0) {
            logger.info(`[ARCHIVE] Removed ${assetCleanup.deleted.length} generated assets`);
          }

          const cachePath = path.join(process.cwd(), ".temp", contentDir, "images.cache.json");
          await removeFromCache(cachePath, `${nameWithoutExt}.heic`);
          await removeFromCache(cachePath, `${nameWithoutExt}.jpg`);

          // Clean up constraints
          const constraintsPath = path.join(dataRoot, contentDir, "clustering-constraints.json");
          await removeImageFromConstraints(constraintsPath, item.id);
        } else {
          errors.push(`Soubor ${nameWithoutExt} nebyl nalezen v ${physicalPicsDir}`);
        }
      } catch (e: any) {
        errors.push(`Chyba při archivaci ${nameWithoutExt}: ${e.message}`);
      }
    }

    if (manifest) {
      manifest.photoDays = manifest.photoDays.map((day) => {
        const originalLength = day.items.length;
        day.items = day.items.filter((i) => !idsToArchive.has(i.id));
        if (day.items.length !== originalLength) {
          manifestModified = true;
        }
        return day;
      });

      if (manifestModified) {
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
    }
  }

  return json({ success: true, archived, errors });
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!dev) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  const { images, updates } = await request.json();

  logger.info("PATCH /api/images request:", { images, updates });

  if (!images || !Array.isArray(images) || !updates) {
    return json({ message: "Invalid request" }, { status: 400 });
  }

  const contentRoot = path.resolve(process.cwd(), "content");
  const dataRoot = path.resolve(process.cwd(), "src/data");

  const errors: string[] = [];
  const updated: string[] = [];

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

  for (const [contentDir, contentDirItems] of Object.entries(itemsByContentDir)) {
    const physicalRoot = path.join(contentRoot, contentDir);
    const manifestPath = path.join(dataRoot, contentDir, "images.manifest.json");

    let manifest: Manifest | null = null;
    let manifestModified = false;

    try {
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      manifest = JSON.parse(manifestContent);
    } catch (_e) {
      errors.push(`Nepodařilo se načíst manifest pro ${contentDir}`);
      continue;
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    ) as Record<string, string | string[] | null>;

    logger.info("Filtered updates for content dir", contentDir, ":", {
      original: updates,
      filtered: filteredUpdates,
    });

    const { getExifToolWriteTags } = await import("$lib/utils/metadata-standards");
    // Explicitly cast to the expected input type for the utility, or allow it if types align
    const tags = getExifToolWriteTags(filteredUpdates);

    if (Object.keys(tags).length === 0) {
      errors.push("Žádná metadata k aktualizaci");
      continue;
    }

    // Use a more specific type than 'any' for the loop item, but since it comes from untyped JSON we can use unknown with casting or a defined interface
    // Ideally we define an interface for the patch payload items
    interface PatchItem {
      id: string;
      src: string;
    }

    for (const item of contentDirItems as PatchItem[]) {
      try {
        const _physicalDir = physicalRoot;
        const srcParts = item.src.split("/");
        const fileName = srcParts[srcParts.length - 1];
        const nameWithoutExt = path.parse(fileName).name;

        let filePath = path.join(physicalRoot, fileName);
        if (!(await fs.stat(filePath).catch(() => null))) {
          const candidate = path.join(physicalRoot, "pics", fileName);
          if (await fs.stat(candidate).catch(() => null)) {
            filePath = candidate;
          } else {
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

        await exiftool.write(filePath, tags, {
          writeArgs: ["-overwrite_original", "-coding=utf8", "-m", "-charset", "iptc=UTF8"],
        });

        updated.push(item.src);

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

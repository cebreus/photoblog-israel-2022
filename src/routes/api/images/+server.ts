import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { json, type RequestEvent } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import { applyMetadataUpdates } from "$lib/shared/metadata-utils";
import type { ImageEntry, Manifest } from "$lib/types/manifest";
import { getExifToolWriteTags } from "$lib/utils/metadata-standards";
import { config } from "$scripts/build.config";
import {
  deleteGeneratedAssets,
  getOutputFolders,
  removeFromCache,
  removeImageFromConstraints,
} from "$scripts/lib/gallery/cleanup";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import { loadImagesManifest, saveImagesManifest } from "$scripts/lib/manifests/repository";

const logger = createLogger("api:images");

type BatchItem = { id: string; src: string; [key: string]: unknown };
type GroupedItems = Record<string, BatchItem[]>;

// --- Helpers ---

function groupItemsByContentDir(items: BatchItem[]): GroupedItems {
  const groups: GroupedItems = {};
  const defaultContentDir = process.env.CONTENT_DIR;

  for (const item of items) {
    if (!item.src) continue;
    const parts = item.src.split("/");
    let key: string | undefined;

    // Expected format: /images/<contentDir>/<filename>
    if (parts.length >= 3 && parts[1] === "images") {
      key = parts[2];
    } else if (defaultContentDir) {
      key = defaultContentDir;
    }

    if (key) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    } else {
      logger.warn(`Could not determine content directory for item ${item.src}`);
    }
  }
  return groups;
}

/**
 * Resolves the physical path of an image file on disk.
 * It checks the "content/<dir>" root and "content/<dir>/pics" subdirectory.
 * It also performs a case-insensitive search if strict match fails.
 */
async function resolvePhysicalPath(contentRoot: string, fileName: string): Promise<string | null> {
  const nameWithoutExt = path.parse(fileName).name;
  const dirsToCheck = [contentRoot, path.join(contentRoot, "pics")];

  for (const dir of dirsToCheck) {
    const directPath = path.join(dir, fileName);
    if (await fs.stat(directPath).catch(() => null)) {
      return directPath;
    }

    // Case-insensitive fallback
    try {
      const files = await fs.readdir(dir);
      const candidates = files.filter(
        (f) => path.parse(f).name.toLowerCase() === nameWithoutExt.toLowerCase(),
      );
      if (candidates.length > 0) {
        return path.join(dir, candidates[0]);
      }
    } catch {}
  }

  return null;
}

/**
 * Wrapper for processing a batch of items within a manifest lock.
 */
async function processBatch(
  contentDir: string,
  items: BatchItem[],
  errors: string[],
  processor: (
    manifest: Manifest | null,
    item: BatchItem,
    physicalPath: string | null,
  ) => Promise<string | null>, // Returns ID of processed item or null if failed
  options: { allowMissingManifest?: boolean } = {},
): Promise<string[]> {
  // Fallback if config placeholder logic is strictly ENV based, construct path manually to be safe for multi-gallery:
  const dataPath = path.resolve(process.cwd(), "src/data", contentDir);
  const contentRoot = path.resolve(process.cwd(), "content", contentDir);

  const processedIds: string[] = [];

  try {
    await withManifestLock(dataPath, async () => {
      const manifest = await loadImagesManifest(dataPath);
      if (!manifest && !options.allowMissingManifest) {
        errors.push(`Manifest not found for ${contentDir}`);
        return;
      }

      let manifestModified = false;
      const processedInThisBatch: Set<string> = new Set();

      for (const item of items) {
        try {
          // Extract filename from src
          const srcParts = item.src.split("/");
          const fileName = decodeURIComponent(srcParts[srcParts.length - 1]);

          const physicalPath = await resolvePhysicalPath(contentRoot, fileName);

          const resultId = await processor(manifest, item, physicalPath);

          if (resultId) {
            processedIds.push(item.src); // or ID? The API usually returns src list.
            processedInThisBatch.add(resultId);
            if (manifest) manifestModified = true;
          }
        } catch (err) {
          errors.push(
            `Error processing ${item.src}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (manifestModified && manifest) {
        // Filter out deleted items if the processor didn't already remove them
        // (Processor might modify manifest in place, or we handle removal here if needed)
        // But logic specific to DELETE vs UPDATE differs (DELETE removes item, UPDATE modifies).
        // So processor should handle manifest modification deeply.
        await saveImagesManifest(dataPath, manifest);
      }
    });
  } catch (err) {
    errors.push(
      `Lock error for ${contentDir}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return processedIds;
}

// --- API Handlers ---

export async function DELETE({ request }: RequestEvent) {
  if (!dev) return json({ message: "Forbidden" }, { status: 403 });

  const { ids } = await request.json();
  if (!ids || !Array.isArray(ids)) return json({ message: "Invalid request" }, { status: 400 });

  const groups = groupItemsByContentDir(ids);
  const deleted: string[] = [];
  const errors: string[] = [];

  const outputFolders = getOutputFolders({
    outputs: config.outputs,
    formats: config.encoding.formats,
  });

  const staticRoot = path.resolve(process.cwd(), "static");
  const tempRoot = path.resolve(process.cwd(), ".temp");
  const dataRoot = path.resolve(process.cwd(), "src/data");

  for (const [contentDir, items] of Object.entries(groups)) {
    // We define a specific processor for DELETE
    const result = await processBatch(
      contentDir,
      items,
      errors,
      async (manifest, item, physicalPath) => {
        // 1. Delete physical file
        if (physicalPath) {
          await fs.unlink(physicalPath);
        } else {
          // If physical file missing, we still want to remove from manifest
          // so we log but proceed.
          // errors.push(`Physical file not found for ${item.src}`);
        }

        const nameWithoutExt = path.parse(item.src).name; // simplified

        // 2. Clean up assets
        const outputRoot = path.join(staticRoot, contentDir, "images");
        await deleteGeneratedAssets(nameWithoutExt, outputRoot, outputFolders);

        // 3. Clean cache
        const cachePath = path.join(tempRoot, contentDir, "images.cache.json");
        await removeFromCache(cachePath, `${nameWithoutExt}.heic`);
        await removeFromCache(cachePath, `${nameWithoutExt}.jpg`);

        // 4. Clean constraints
        const constraintsPath = path.join(dataRoot, contentDir, "clustering-constraints.json");
        await removeImageFromConstraints(constraintsPath, item.id);

        // 5. Update Manifest
        let itemRemoved = false;
        if (manifest) {
          manifest.photoDays = manifest.photoDays.map((day) => {
            const initialLen = day.items.length;
            day.items = day.items.filter((i) => i.id !== item.id);
            if (day.items.length !== initialLen) itemRemoved = true;
            return day;
          });
        }

        // If item was removed from manifest OR physical file existed (and was deleted), count as success
        if (itemRemoved || physicalPath) return item.id;

        errors.push(`Item ${item.id} not found in manifest or disk`);
        return null;
      },
      { allowMissingManifest: true },
    );
    deleted.push(...result);
  }

  return json({ success: true, deleted, errors });
}

export async function POST({ request }: RequestEvent) {
  if (!dev) return json({ message: "Forbidden" }, { status: 403 });

  const { ids, action } = await request.json();
  if (action !== "archive") return json({ message: "Invalid action" }, { status: 400 });
  if (!ids || !Array.isArray(ids)) return json({ message: "Invalid request" }, { status: 400 });

  const groups = groupItemsByContentDir(ids);
  const archived: string[] = [];
  const errors: string[] = [];

  const staticRoot = path.resolve(process.cwd(), "static");
  const tempRoot = path.resolve(process.cwd(), ".temp");
  const dataRoot = path.resolve(process.cwd(), "src/data");

  for (const [contentDir, items] of Object.entries(groups)) {
    const archiveDir = path.resolve(process.cwd(), "content", contentDir, "archive");
    await fs.mkdir(archiveDir, { recursive: true });

    const result = await processBatch(
      contentDir,
      items,
      errors,
      async (manifest, item, physicalPath) => {
        if (!physicalPath) {
          throw new Error("Physical file not found, cannot archive");
        }

        // 1. Move file
        const fileName = path.basename(physicalPath);
        const destPath = path.join(archiveDir, fileName);
        await fs.rename(physicalPath, destPath);

        const nameWithoutExt = path.parse(fileName).name;

        // 2. Clean assets
        const outputRoot = path.join(staticRoot, contentDir, "images");
        const outputFolders = getOutputFolders({
          outputs: config.outputs,
          formats: config.encoding.formats,
        });
        await deleteGeneratedAssets(nameWithoutExt, outputRoot, outputFolders);

        // 3. Clean cache
        const cachePath = path.join(tempRoot, contentDir, "images.cache.json");
        for (const ext of config.script.inputExtensions) {
          await removeFromCache(cachePath, `${nameWithoutExt}.${ext}`);
        }

        // 4. Clean constraints
        const constraintsPath = path.join(dataRoot, contentDir, "clustering-constraints.json");
        await removeImageFromConstraints(constraintsPath, item.id);

        // 5. Update Manifest
        if (manifest) {
          manifest.photoDays = manifest.photoDays.map((day) => {
            day.items = day.items.filter((i) => i.id !== item.id);
            return day;
          });
        }

        return item.id;
      },
      { allowMissingManifest: true },
    );
    archived.push(...result);
  }

  return json({ success: true, archived, errors });
}

export async function PATCH({ request }: RequestEvent) {
  if (!dev) return json({ message: "Forbidden" }, { status: 403 });

  const { images, updates } = await request.json();
  if (!images || !Array.isArray(images) || images.length === 0 || !updates)
    return json({ message: "Invalid request" }, { status: 400 });

  const groups = groupItemsByContentDir(images);
  const updatedIds: string[] = [];
  const updatedImages: ImageEntry[] = []; // Track full objects
  const errors: string[] = [];

  // Filter valid updates
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  ) as Record<string, string | string[] | null>;

  const tags = getExifToolWriteTags(filteredUpdates);
  if (Object.keys(tags).length === 0) {
    return json({ message: "No metadata to update", errors: ["No valid tags"] }, { status: 500 });
  }

  for (const [contentDir, items] of Object.entries(groups)) {
    const result = await processBatch(
      contentDir,
      items,
      errors,
      async (manifest, item, physicalPath) => {
        if (!physicalPath) {
          throw new Error("Physical file not found");
        }

        // 1. Write EXIF
        await exiftool.write(physicalPath, tags, {
          writeArgs: ["-overwrite_original", "-coding=utf8", "-m", "-charset", "iptc=UTF8"],
        });

        // 2. Update Manifest
        if (!manifest) throw new Error("Manifest failed to load");

        let foundItem: ImageEntry | null = null;
        for (const day of manifest.photoDays) {
          for (const imageItem of day.items) {
            if (imageItem.type === "image" && imageItem.id === item.id) {
              applyMetadataUpdates(imageItem, filteredUpdates);
              foundItem = imageItem;
              break;
            }
          }
          if (foundItem) break;
        }

        if (foundItem) {
          updatedImages.push(foundItem);
          return item.id;
        }

        return null;
      },
    );
    updatedIds.push(...result);
  }

  if (updatedIds.length === 0 && errors.length > 0) {
    return json({ message: "Failed to update metadata", errors }, { status: 500 });
  }

  // Return both IDs and the full updated objects
  return json({ success: true, updated: updatedIds, updatedImages, errors });
}

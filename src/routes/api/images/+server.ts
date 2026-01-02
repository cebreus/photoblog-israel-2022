import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { json, type RequestEvent } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import { applyMetadataUpdates } from "$lib/shared/metadata-utils";
import { type ImageEntry, isImageEntry, type Manifest } from "$lib/types/manifest";
import { reloadManifests } from "$lib/utils/images";
import { getExifToolWriteTags } from "$lib/utils/metadata-standards";
import { config } from "$scripts/build.config";
import {
  deleteGeneratedAssets,
  getOutputFolders,
  removeFromCache,
  removeImageFromConstraints,
} from "$scripts/lib/gallery/cleanup";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadAnalysisManifest,
  loadEmbeddingsManifest,
  loadFacesManifest,
  loadImagesManifest,
  saveAnalysisManifest,
  saveEmbeddingsManifest,
  saveFacesManifest,
  saveImagesManifest,
} from "$scripts/lib/manifests/repository";

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
  const dirsToCheck = [
    contentRoot,
    path.join(contentRoot, "pics"),
    // also check for moved collage sources (content/<dir>/collage-sources)
    path.join(contentRoot, "collage-sources"),
  ];

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
  ) => Promise<string | string[] | null>, // Returns ID(s) of processed item(s) or null if failed
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
        if (processedInThisBatch.has(item.id)) continue;

        try {
          // Extract filename from src
          const srcParts = item.src.split("/");
          const fileName = decodeURIComponent(srcParts[srcParts.length - 1]);

          const physicalPath = await resolvePhysicalPath(contentRoot, fileName);

          const rawResult = await processor(manifest, item, physicalPath);

          if (rawResult) {
            const ids = Array.isArray(rawResult) ? rawResult : [rawResult];
            processedIds.push(...ids);
            for (const id of ids) processedInThisBatch.add(id);
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
        logger.info(
          `processBatch: Saving manifest for ${contentDir}, modified=${manifestModified}, processedIds=${processedIds.length}`,
        );
        await saveImagesManifest(dataPath, manifest);
        logger.info(`processBatch: Manifest saved successfully to ${dataPath}`);

        // Also remove any stale entries from auxiliary manifests (analysis/embeddings/faces)
        // for the items processed in this batch. We do this here under the same lock so
        // concurrent operations remain consistent.
        try {
          const processedIdsArray = Array.from(processedInThisBatch);

          // Analysis
          try {
            const analysisManifest = (await loadAnalysisManifest(dataPath)) || {};
            let changed = false;
            for (const id of processedIdsArray) {
              if (Object.hasOwn(analysisManifest, id)) {
                delete (analysisManifest as Record<string, unknown>)[id];
                changed = true;
              }
            }
            if (changed) await saveAnalysisManifest(dataPath, analysisManifest);
          } catch (_e: unknown) {}

          // Embeddings
          try {
            const embeddingsManifest = (await loadEmbeddingsManifest(dataPath)) || {};
            let changed = false;
            for (const id of processedIdsArray) {
              if (Object.hasOwn(embeddingsManifest, id)) {
                delete (embeddingsManifest as Record<string, unknown>)[id];
                changed = true;
              }
            }
            if (changed)
              await saveEmbeddingsManifest(
                dataPath,
                embeddingsManifest as Record<string, number[]>,
              );
          } catch (_e: unknown) {}

          // Faces
          try {
            const facesManifest = (await loadFacesManifest(dataPath)) || {};
            let changed = false;
            for (const id of processedIdsArray) {
              if (Object.hasOwn(facesManifest, id)) {
                delete (facesManifest as Record<string, unknown>)[id];
                changed = true;
              }
            }
            if (changed) await saveFacesManifest(dataPath, facesManifest);
          } catch (_e: unknown) {}
        } catch (_e: unknown) {}
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
        const nameWithoutExt = path.parse(item.src).name; // simplified

        // 1. Clean up assets
        const outputRoot = path.join(staticRoot, contentDir, "images");
        await deleteGeneratedAssets(nameWithoutExt, outputRoot, outputFolders);

        // 2. Clean cache
        const cachePath = path.join(tempRoot, contentDir, "images.cache.json");
        await removeFromCache(cachePath, `${nameWithoutExt}.heic`);
        await removeFromCache(cachePath, `${nameWithoutExt}.jpg`);

        // 3. Clean constraints
        const constraintsPath = path.join(dataRoot, contentDir, "clustering-constraints.json");
        await removeImageFromConstraints(constraintsPath, item.id);

        // 4. Update Manifest
        let itemRemoved = false;
        if (manifest) {
          manifest.photoDays = manifest.photoDays.map((day) => {
            const initialLen = day.items.length;
            day.items = day.items.filter((i) => i.id !== item.id);
            if (day.items.length !== initialLen) itemRemoved = true;
            return day;
          });
        }

        // 5. Delete physical file (LAST STEP)
        // Only proceed if manifest update was successful or not needed
        if (physicalPath) {
          try {
            await fs.unlink(physicalPath);
          } catch (e) {
            // If unlink fails, we have a problem: Manifest updated, file remains.
            // This is an "Orphaned File" state, which is safer than "Ghost Record" (File gone, Manifest entry remains).
            // We count this as success effectively, because the app logic is consistent (item gone from UI).
            logger.warn(`Failed to delete file ${physicalPath}: ${(e as Error).message}`);
          }
        } else {
          // errors.push(`Physical file not found for ${item.src}`);
        }

        // If item was removed from manifest OR physical file existed (and was deleted/attempted), count as success
        if (itemRemoved || physicalPath) return item.id;

        errors.push(`Item ${item.id} not found in manifest or disk`);
        return null;
      },
      { allowMissingManifest: true },
    );
    deleted.push(...result);
  }

  // Force reload of in-memory manifest cache
  await reloadManifests();

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

        const fileName = path.basename(physicalPath);
        const nameWithoutExt = path.parse(fileName).name;

        // 1. Clean assets
        const outputRoot = path.join(staticRoot, contentDir, "images");
        const outputFolders = getOutputFolders({
          outputs: config.outputs,
          formats: config.encoding.formats,
        });
        await deleteGeneratedAssets(nameWithoutExt, outputRoot, outputFolders);

        // 2. Clean cache
        const cachePath = path.join(tempRoot, contentDir, "images.cache.json");
        for (const ext of config.script.inputExtensions) {
          await removeFromCache(cachePath, `${nameWithoutExt}.${ext}`);
        }

        // 3. Clean constraints
        const constraintsPath = path.join(dataRoot, contentDir, "clustering-constraints.json");
        await removeImageFromConstraints(constraintsPath, item.id);

        // 4. Move file (CRITICAL STEP)
        // We move the file BEFORE updating the manifest.
        // If this fails, the manifest remains untouched and consistent.
        // If it succeeds, but manifest update crashes (unlikely), we have a ghost record.
        const destPath = path.join(archiveDir, fileName);
        await fs.rename(physicalPath, destPath);

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

  // Force reload of in-memory manifest cache
  await reloadManifests();

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

  for (const [contentDir, items] of Object.entries(groups)) {
    const result = await processBatch(
      contentDir,
      items,
      errors,
      async (manifest, item, physicalPath) => {
        if (!manifest) throw new Error("Manifest failed to load");

        // Find the main item in manifest
        let mainEntry: ImageEntry | null = null;
        for (const day of manifest.photoDays) {
          for (const i of day.items) {
            if (i.id === item.id && isImageEntry(i)) {
              mainEntry = i;
              break;
            }
          }
          if (mainEntry) break;
        }

        if (!mainEntry) {
          return null; // Item not found in manifest
        }

        const targets: ImageEntry[] = [mainEntry];

        // Check for siblings (sequence/group members)
        if (mainEntry.sequenceInfo) {
          const baseId = mainEntry.sequenceInfo.baseId;
          for (const day of manifest.photoDays) {
            for (const i of day.items) {
              if (isImageEntry(i) && i.sequenceInfo?.baseId === baseId && i.id !== mainEntry.id) {
                targets.push(i);
              }
            }
          }
        }

        const processedIds: string[] = [];
        const contentRoot = path.resolve(process.cwd(), "content", contentDir);

        for (const target of targets) {
          let targetPath: string | null = null;

          // Optimization: Use provided physicalPath for the main item
          if (target.id === item.id) {
            targetPath = physicalPath;
          } else {
            const srcParts = target.src.split("/");
            const fileName = decodeURIComponent(srcParts[srcParts.length - 1]);
            targetPath = await resolvePhysicalPath(contentRoot, fileName);
          }

          if (!targetPath) continue;

          // 1. Prepare metadata for EXIF write
          // biome-ignore lint/suspicious/noExplicitAny: Dynamic metadata merging requires any
          const fullExifUpdates: any = { ...filteredUpdates };

          // Use target's existing keywords/flags if not explicitly updated
          if (updates.keywords === undefined) {
            fullExifUpdates.keywords = target.keywords || [];
          }
          if (updates.flags === undefined) {
            fullExifUpdates.flags = target.flags || [];
          }

          const writeTags = getExifToolWriteTags(fullExifUpdates);

          // Write EXIF (only if there are tags to write)
          if (Object.keys(writeTags).length > 0) {
            try {
              await exiftool.write(targetPath, writeTags, {
                writeArgs: ["-overwrite_original", "-coding=utf8", "-m", "-charset", "iptc=UTF8"],
              });
            } catch (exifError) {
              const msg = `ExifTool failed for ${targetPath}: ${exifError}`;
              logger.error(msg);
              throw new Error(msg);
            }
          }

          // 2. Update Manifest (optimistic update to the in-memory manifest)
          applyMetadataUpdates(target, filteredUpdates);
          updatedImages.push(target);
          processedIds.push(target.id);
        }

        logger.info(
          `PATCH: Processed ${processedIds.length} items for baseId ${mainEntry.sequenceInfo?.baseId || item.id}`,
        );
        return processedIds.length > 0 ? processedIds : null;
      },
    );
    updatedIds.push(...result);
  }

  if (updatedIds.length === 0 && errors.length > 0) {
    return json({ message: "Failed to update metadata", errors }, { status: 500 });
  }

  // Return both IDs and the full updated objects
  // Return both IDs and the full updated objects
  // Force reload of in-memory manifest cache
  await reloadManifests();

  return json({ success: true, updated: updatedIds, updatedImages, errors });
}

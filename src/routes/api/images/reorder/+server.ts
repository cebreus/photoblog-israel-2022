import path from "node:path";
import process from "node:process";
import { json, type RequestEvent } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import type { ImageEntry, SortOrderManifest } from "$lib/types/manifest";
import { reloadManifests } from "$lib/utils/images";
import { organizeDayItems } from "$scripts/lib/manifests/builder";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadImagesManifest,
  loadSortOrderManifest,
  saveImagesManifest,
  saveSortOrderManifest,
} from "$scripts/lib/manifests/repository";
import { loadStoryData } from "./loader";

const logger = createLogger("api:images:reorder");

/**
 * Payload for reordering images within a day.
 */
type ReorderPayload = {
  /** Day ID (e.g., "day-2025-11-25") or date string (e.g., "2025-11-25") */
  dayId: string;
  /** Ordered list of image IDs in the new sequence */
  imageIds: string[];
  /** Content directory (e.g., "egypt-2025"). If omitted, uses CONTENT_DIR env. */
  contentDir?: string;
};

/**
 * PATCH /api/images/reorder
 *
 * Updates the sortOrder of images within a specific day.
 * The order is persisted to sortorder.manifest.json (survives rebuilds)
 * and also applied to images.manifest.json for immediate effect.
 */
export async function PATCH({ request }: RequestEvent) {
  if (!dev) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  let payload: ReorderPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { dayId, imageIds, contentDir } = payload;

  if (!dayId || !imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
    return json({ message: "Missing dayId or imageIds" }, { status: 400 });
  }

  const resolvedContentDir = contentDir || process.env.CONTENT_DIR;
  if (!resolvedContentDir) {
    return json({ message: "Content directory not specified" }, { status: 400 });
  }

  const dataPath = path.resolve(process.cwd(), "src/data", resolvedContentDir);
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    await withManifestLock(dataPath, async () => {
      // 1. Load both manifests
      const manifest = await loadImagesManifest(dataPath);
      if (!manifest) {
        errors.push(`Images manifest not found for ${resolvedContentDir}`);
        return;
      }

      const sortOrderManifest: SortOrderManifest = (await loadSortOrderManifest(dataPath)) || {};

      // 2. Find the target day
      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day-${dayId}`;
      const targetDay = manifest.photoDays.find(
        (day) => day.id === normalizedDayId || day.date === dayId.replace("day-", ""),
      );

      if (!targetDay) {
        errors.push(`Day ${dayId} not found in manifest`);
        return;
      }

      // 3. Save to persistent sortorder.manifest.json
      sortOrderManifest[normalizedDayId] = imageIds;
      await saveSortOrderManifest(dataPath, sortOrderManifest);
      logger.info(`Saved sort order for ${normalizedDayId} to sortorder.manifest.json`);

      // 4. Also apply to images.manifest.json for immediate effect
      const orderMap = new Map<string, number>();
      imageIds.forEach((id, index) => {
        orderMap.set(id, index + 1); // 1-based indexing
      });

      for (const item of targetDay.items) {
        if (item.type === "separator") continue;

        const imageItem = item as ImageEntry;
        const newOrder = orderMap.get(imageItem.id);

        if (newOrder !== undefined) {
          imageItem.sortOrder = newOrder;
          updatedCount++;
          logger.debug(`Set sortOrder for ${imageItem.id} to ${newOrder}`);
        } else {
          // Image not in the reorder list - clear its sortOrder
          if (imageItem.sortOrder !== undefined) {
            delete imageItem.sortOrder;
            logger.debug(`Cleared sortOrder for ${imageItem.id}`);
          }
        }
      }

      // 5. Re-organize the day items (sorts by sortOrder and regenerates separators)
      // We need to load story data for this to work correctly with separators
      const storyData = await loadStoryData(
        path.resolve(process.cwd(), "content", resolvedContentDir),
      );

      // organizeDayItems expects the day object to be mutable/compatible
      // It sorts items and regenerates separators based on the new order
      const newDay = organizeDayItems(targetDay, storyData);

      // Update the day in the manifest
      const dayIndex = manifest.photoDays.indexOf(targetDay);
      if (dayIndex !== -1) {
        manifest.photoDays[dayIndex] = newDay;
      }

      await saveImagesManifest(dataPath, manifest);
      logger.info(`Applied sortOrder to ${updatedCount} images in ${normalizedDayId}`);
    });

    // Reload in-memory manifests so the UI gets fresh data immediately
    await reloadManifests();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to reorder images: ${message}`);
    errors.push(message);
  }

  if (errors.length > 0 && updatedCount === 0) {
    return json({ success: false, message: errors.join("; "), errors }, { status: 500 });
  }

  return json({
    success: true,
    updated: updatedCount,
    dayId,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * DELETE /api/images/reorder
 *
 * Clears sortOrder from all images in a day, reverting to EXIF date ordering.
 * Also removes the day from sortorder.manifest.json.
 */
export async function DELETE({ request }: RequestEvent) {
  if (!dev) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  let payload: Pick<ReorderPayload, "dayId" | "contentDir">;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { dayId, contentDir } = payload;

  if (!dayId) {
    return json({ message: "Missing dayId" }, { status: 400 });
  }

  const resolvedContentDir = contentDir || process.env.CONTENT_DIR;
  if (!resolvedContentDir) {
    return json({ message: "Content directory not specified" }, { status: 400 });
  }

  const dataPath = path.resolve(process.cwd(), "src/data", resolvedContentDir);
  const errors: string[] = [];
  let clearedCount = 0;

  try {
    await withManifestLock(dataPath, async () => {
      const manifest = await loadImagesManifest(dataPath);
      if (!manifest) {
        errors.push(`Manifest not found for ${resolvedContentDir}`);
        return;
      }

      const sortOrderManifest: SortOrderManifest = (await loadSortOrderManifest(dataPath)) || {};

      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day-${dayId}`;

      // 1. Remove from persistent sortorder.manifest.json
      if (sortOrderManifest[normalizedDayId]) {
        delete sortOrderManifest[normalizedDayId];
        await saveSortOrderManifest(dataPath, sortOrderManifest);
        logger.info(`Removed ${normalizedDayId} from sortorder.manifest.json`);
      }

      // 2. Clear sortOrder from images.manifest.json
      const targetDay = manifest.photoDays.find(
        (day) => day.id === normalizedDayId || day.date === dayId.replace("day-", ""),
      );

      if (!targetDay) {
        errors.push(`Day ${dayId} not found in manifest`);
        return;
      }

      for (const item of targetDay.items) {
        if (item.type === "separator") continue;

        const imageItem = item as ImageEntry;
        if (imageItem.sortOrder !== undefined) {
          delete imageItem.sortOrder;
          clearedCount++;
        }
      }

      // 3. Re-organize to restore default sort (EXIF date)
      const storyData = await loadStoryData(
        path.resolve(process.cwd(), "content", resolvedContentDir),
      );
      const newDay = organizeDayItems(targetDay, storyData);

      const dayIndex = manifest.photoDays.indexOf(targetDay);
      if (dayIndex !== -1) {
        manifest.photoDays[dayIndex] = newDay;
      }

      await saveImagesManifest(dataPath, manifest);
      logger.info(`Cleared sortOrder from ${clearedCount} images in ${normalizedDayId}`);
    });

    // Reload in-memory manifests so the UI gets fresh data immediately
    await reloadManifests();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to clear sortOrder: ${message}`);
    errors.push(message);
  }

  if (errors.length > 0 && clearedCount === 0) {
    return json({ success: false, message: errors.join("; "), errors }, { status: 500 });
  }

  return json({
    success: true,
    cleared: clearedCount,
    dayId,
    errors: errors.length > 0 ? errors : undefined,
  });
}

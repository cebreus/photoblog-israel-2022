import path from "node:path";
import process from "node:process";
import { json, type RequestEvent } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import { dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import type { ImageEntry } from "$lib/types/manifest";
import { reloadManifests } from "$lib/utils/images";
import { organizeDayItems } from "$scripts/lib/manifests/builder";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import { loadImagesManifest, saveImagesManifest } from "$scripts/lib/manifests/repository";
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
 * Reorders images by modifying their XMP:ReleaseDate values.
 * This persists the order directly in the image files.
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
  const contentDirRoot = path.resolve(process.cwd(), "content", resolvedContentDir);
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    await withManifestLock(dataPath, async () => {
      // 1. Load manifest
      const manifest = await loadImagesManifest(dataPath);
      if (!manifest) {
        errors.push(`Images manifest not found for ${resolvedContentDir}`);
        return;
      }

      // 2. Find the target day
      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day-${dayId}`;
      const targetDay = manifest.photoDays.find(
        (day) => day.id === normalizedDayId || day.date === dayId.replace("day-", ""),
      );

      if (!targetDay) {
        errors.push(`Day ${dayId} not found in manifest`);
        return;
      }

      // 3. Get current image items
      const imageItems = targetDay.items.filter(
        (item) => item.type !== "separator",
      ) as ImageEntry[];

      // 4. Calculate new ReleaseDate values (only for moved images)
      const newDates = calculateReleaseDates(imageIds, imageItems);

      // 5. Ensure all images have ReleaseDate initialized
      await ensureReleaseDatesExist(imageItems, contentDirRoot);

      // 6. Write to files using exiftool (only changed images)
      for (const [id, releaseDate] of Object.entries(newDates)) {
        const imagePath = await resolveImagePath(id, contentDirRoot);
        if (!imagePath) {
          logger.warn(`Could not resolve path for image ${id}`);
          continue;
        }

        await exiftool.write(imagePath, {
          "XMP:ReleaseDate": releaseDate,
        } as any);
        updatedCount++;
      }

      // 6. Update manifest
      for (const item of targetDay.items) {
        if (item.type === "separator") continue;
        const imageItem = item as ImageEntry;

        if (newDates[imageItem.id]) {
          if (!imageItem.exif) imageItem.exif = {};
          imageItem.exif.releaseDate = newDates[imageItem.id];
        }
      }

      // 7. Re-organize the day items (sorts by releaseDate and regenerates separators)
      const storyData = await loadStoryData(contentDirRoot);
      const newDay = organizeDayItems(targetDay, storyData);

      // Update the day in the manifest
      const dayIndex = manifest.photoDays.indexOf(targetDay);
      if (dayIndex !== -1) {
        manifest.photoDays[dayIndex] = newDay;
      }

      await saveImagesManifest(dataPath, manifest);
      logger.info(`Updated ReleaseDate for ${updatedCount} images in ${normalizedDayId}`);
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
 * Calculate ReleaseDate values for moved images only.
 * Strategy: For each moved image, set its ReleaseDate to the target position's time minus 10 seconds.
 * This preserves original times for unmoved images and allows space for future insertions.
 *
 * @param imageIds - New ordered list of image IDs
 * @param currentItems - Current day items with existing releaseDate values
 * @returns Map of imageId -> new ReleaseDate (only for images that need updating)
 */
function calculateReleaseDates(
  imageIds: string[],
  currentItems: ImageEntry[],
): Record<string, string> {
  const result: Record<string, string> = {};

  // Build map of current positions and releaseDates
  const currentOrder = currentItems.map((item) => item.id);
  const releaseDateMap = new Map<string, string>();

  for (const item of currentItems) {
    const releaseDate = item.exif?.releaseDate || item.exif?.date;
    if (releaseDate) {
      releaseDateMap.set(item.id, releaseDate);
    }
  }

  // Find images that changed position
  for (let newIndex = 0; newIndex < imageIds.length; newIndex++) {
    const imageId = imageIds[newIndex];
    const oldIndex = currentOrder.indexOf(imageId);

    // Skip if image didn't move
    if (oldIndex === newIndex) continue;

    // Get neighbors in the NEW order
    const previousImageId = newIndex > 0 ? imageIds[newIndex - 1] : null;
    const nextImageId = newIndex < imageIds.length - 1 ? imageIds[newIndex + 1] : null;

    if (previousImageId && nextImageId) {
      // Insertion between two images: interpolate (average their times)
      const prevTime = releaseDateMap.get(previousImageId);
      const nextTime = releaseDateMap.get(nextImageId);

      if (prevTime && nextTime) {
        const prevMs = new Date(prevTime).getTime();
        const nextMs = new Date(nextTime).getTime();
        const avgMs = Math.floor((prevMs + nextMs) / 2);
        result[imageId] = new Date(avgMs).toISOString();
      }
    } else if (nextImageId) {
      // Move to beginning: next image time minus 10 minutes
      const nextTime = releaseDateMap.get(nextImageId);
      if (nextTime) {
        const nextDate = new Date(nextTime);
        nextDate.setMinutes(nextDate.getMinutes() - 10);
        result[imageId] = nextDate.toISOString();
      }
    } else if (previousImageId) {
      // Move to end: previous image time plus 10 minutes
      const prevTime = releaseDateMap.get(previousImageId);
      if (prevTime) {
        const prevDate = new Date(prevTime);
        prevDate.setMinutes(prevDate.getMinutes() + 10);
        result[imageId] = prevDate.toISOString();
      }
    }
  }

  return result;
}

/**
 * Ensure all images have ReleaseDate initialized.
 * If missing, initialize from DateTimeOriginal.
 */
async function ensureReleaseDatesExist(
  dayItems: ImageEntry[],
  contentDirRoot: string,
): Promise<void> {
  const needsInit: ImageEntry[] = [];

  for (const item of dayItems) {
    if (!item.exif?.releaseDate) {
      needsInit.push(item);
    }
  }

  if (needsInit.length === 0) return;

  // Initialize missing ReleaseDates from DateTimeOriginal
  for (const item of needsInit) {
    const imagePath = await resolveImagePath(item.id, contentDirRoot);
    if (!imagePath) continue;

    const initialDate = item.exif?.date ?? new Date().toISOString();

    await exiftool.write(imagePath, {
      "XMP:ReleaseDate": initialDate,
    } as any);

    if (!item.exif) item.exif = {};
    item.exif.releaseDate = initialDate;
  }

  logger.info(`Initialized ReleaseDate for ${needsInit.length} images`);
}

/**
 * Resolve image ID to filesystem path.
 */
async function resolveImagePath(imageId: string, contentDirRoot: string): Promise<string | null> {
  const extensions = [".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG", ".heic", ".HEIC"];
  const searchPaths = [
    path.join(contentDirRoot, "pics"),
    path.join(contentDirRoot, "collage-sources"),
  ];

  const { fileExists } = await import("$scripts/lib/utils/runtime");

  for (const basePath of searchPaths) {
    for (const ext of extensions) {
      const testPath = path.join(basePath, imageId + ext);
      if (await fileExists(testPath)) {
        return testPath;
      }
    }
  }

  return null;
}

/**
 * DELETE /api/images/reorder
 *
 * Resets ReleaseDate for all images in a day to their DateTimeOriginal values,
 * effectively reverting to chronological EXIF order.
 *
 * NOTE: We do NOT delete ReleaseDate - we reset it. ReleaseDate must always exist.
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
  const contentDirRoot = path.resolve(process.cwd(), "content", resolvedContentDir);
  const errors: string[] = [];
  let resetCount = 0;

  try {
    await withManifestLock(dataPath, async () => {
      const manifest = await loadImagesManifest(dataPath);
      if (!manifest) {
        errors.push(`Manifest not found for ${resolvedContentDir}`);
        return;
      }

      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day-${dayId}`;

      // 1. Find the target day
      const targetDay = manifest.photoDays.find(
        (day) => day.id === normalizedDayId || day.date === dayId.replace("day-", ""),
      );

      if (!targetDay) {
        errors.push(`Day ${dayId} not found in manifest`);
        return;
      }

      // 2. For each image, reset XMP:ReleaseDate to DateTimeOriginal
      for (const item of targetDay.items) {
        if (item.type === "separator") continue;

        const imageItem = item as ImageEntry;
        const imagePath = await resolveImagePath(imageItem.id, contentDirRoot);
        if (!imagePath) {
          logger.warn(`Could not resolve path for image ${imageItem.id}`);
          continue;
        }

        // Get the original EXIF date
        const originalDate = imageItem.exif?.date ?? new Date().toISOString();

        // Reset ReleaseDate to match DateTimeOriginal
        await exiftool.write(imagePath, {
          "XMP:ReleaseDate": originalDate,
        } as any);

        // Update manifest - releaseDate now equals original date
        if (!imageItem.exif) imageItem.exif = {};
        imageItem.exif.releaseDate = originalDate;
        resetCount++;
      }

      // 3. Re-organize to restore default sort (EXIF date)
      const storyData = await loadStoryData(contentDirRoot);
      const newDay = organizeDayItems(targetDay, storyData);

      const dayIndex = manifest.photoDays.indexOf(targetDay);
      if (dayIndex !== -1) {
        manifest.photoDays[dayIndex] = newDay;
      }

      await saveImagesManifest(dataPath, manifest);
      logger.info(`Reset ReleaseDate for ${resetCount} images in ${normalizedDayId}`);
    });

    // Reload in-memory manifests so the UI gets fresh data immediately
    await reloadManifests();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to reset order: ${message}`);
    errors.push(message);
  }

  if (errors.length > 0 && resetCount === 0) {
    return json({ success: false, message: errors.join("; "), errors }, { status: 500 });
  }

  return json({
    success: true,
    reset: resetCount,
    dayId,
    message: "Order reset to EXIF dates",
    errors: errors.length > 0 ? errors : undefined,
  });
}

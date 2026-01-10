import { dev } from "$app/environment";
import type { ImageEntry } from "$lib/types/manifest";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { organizeDayItems } from "$scripts/manifests/builder";
import { withManifestLock } from "$scripts/manifests/lock";
import { loadImagesManifest, saveImagesManifest } from "$scripts/manifests/repository";
import { fileExists } from "$scripts/utils/runtime";
import { SEARCH_EXTENSIONS } from "$shared/types/images";
import { getLocalNowIsoString } from "$shared/utils/dates";
import { calculateReleaseDates } from "$shared/utils/sorting";
import { json, type RequestEvent } from "@sveltejs/kit";
import { exiftool, type WriteTags } from "exiftool-vendored";
import path from "node:path";
import process from "node:process";
import { loadStoryData } from "./loader";

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
export async function PATCH({ request, locals }: RequestEvent) {
  const { log, logContext } = locals;
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
      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day - ${dayId} `;
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
      await ensureReleaseDatesExist(imageItems, contentDirRoot, log);

      // 6. Write to files using exiftool (only changed images)
      for (const [id, releaseDate] of Object.entries(newDates)) {
        const imagePath = await resolveImagePath(id, contentDirRoot);
        if (!imagePath) {
          log.warn({ imageId: id }, "Could not resolve path for image");
          continue;
        }

        // Get original value for logging
        const imageItem = imageItems.find((item) => item.id === id);
        const originalReleaseDate = imageItem?.exif?.releaseDate;

        await exiftool.write(imagePath, {
          "XMP:ReleaseDate": releaseDate,
        } as WriteTags);

        log.info(
          {
            imageId: id,
            originalReleaseDate,
            newReleaseDate: releaseDate,
          },
          "Updated ReleaseDate for image",
        );

        updatedCount++;
      }

      // 6. Update manifest
      for (const item of targetDay.items) {
        if (item.type === "separator") continue;
        const imageItem = item as ImageEntry;

        if (newDates[imageItem.id]) {
          if (!imageItem.exif) imageItem.exif = {} as ImageEntry["exif"];
          const exif = imageItem.exif;
          if (exif) exif.releaseDate = newDates[imageItem.id];
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
      log.info(
        {
          updatedCount,
          totalImages: imageItems.length,
          dayId: normalizedDayId,
        },
        "Completed ReleaseDate updates for day",
      );
    });

    // Reload in-memory manifests so the UI gets fresh data immediately
    await reloadManifests();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err, message }, "Failed to reorder images");
    errors.push(message);
  }

  logContext.dayId = dayId;
  logContext.imageIdsCount = imageIds.length;
  logContext.updatedCount = updatedCount;

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
 * Ensure all images have ReleaseDate initialized.
 * If missing, initialize from DateTimeOriginal.
 */
async function ensureReleaseDatesExist(
  dayItems: ImageEntry[],
  contentDirRoot: string,
  log: App.Locals["log"],
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

    const initialDate = item.exif?.date ?? getLocalNowIsoString();

    await exiftool.write(imagePath, {
      "XMP:ReleaseDate": initialDate,
    } as WriteTags);

    if (!item.exif) item.exif = {} as ImageEntry["exif"];
    const exif = item.exif;
    if (exif) exif.releaseDate = initialDate;
  }

  log.info({ count: needsInit.length }, "Initialized ReleaseDate for images");
}

/**
 * Resolve image ID to filesystem path.
 */
async function resolveImagePath(imageId: string, contentDirRoot: string): Promise<string | null> {
  const searchPaths = [
    path.join(contentDirRoot, "pics"),
    path.join(contentDirRoot, "pics", "collage-sources"),
  ];

  for (const basePath of searchPaths) {
    for (const ext of SEARCH_EXTENSIONS) {
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
export async function DELETE({ request, locals }: RequestEvent) {
  const { log } = locals;

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

      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day - ${dayId} `;

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
          log.warn({ imageId: imageItem.id }, "Could not resolve path for image");
          continue;
        }

        // Get the original EXIF date
        const originalDate = imageItem.exif?.date ?? getLocalNowIsoString();

        // Reset ReleaseDate to match DateTimeOriginal
        await exiftool.write(imagePath, {
          "XMP:ReleaseDate": originalDate,
        } as WriteTags);

        // Update manifest - releaseDate now equals original date
        if (!imageItem.exif) imageItem.exif = {} as ImageEntry["exif"];
        const exif = imageItem.exif;
        if (exif) exif.releaseDate = originalDate;
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
      log.info({ resetCount, dayId: normalizedDayId }, `Reset ReleaseDate for images in day`);
    });

    // Reload in-memory manifests so the UI gets fresh data immediately
    await reloadManifests();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Failed to reset order");
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

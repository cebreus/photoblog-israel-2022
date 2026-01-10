import { dev } from "$app/environment";
import type { ImageEntry } from "$lib/types/manifest";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { organizeDayItems } from "$scripts/manifests/builder";
import { withManifestLock } from "$scripts/manifests/lock";
import { loadImagesManifest, saveImagesManifest } from "$scripts/manifests/repository";
import { fileExists } from "$scripts/utils/runtime";
import { SEARCH_EXTENSIONS } from "$shared/types/images";
import { distributeTimesInRange } from "$shared/utils/sorting";
import { json, type RequestEvent } from "@sveltejs/kit";
import { exiftool, type WriteTags } from "exiftool-vendored";
import path from "node:path";
import process from "node:process";
import { loadStoryData } from "../reorder/loader";

type RedistributePayload = {
  dayId: string;
  location?: string; // Optional: redistribute all images in this location
  imageIds?: string[]; // Optional: redistribute only these specific images
  contentDir?: string;
};

/**
 * POST /api/images/redistribute
 * Redistributes images evenly across their time bounds.
 * Supports two modes:
 * 1. Location mode: redistribute all images in a location (requires 'location')
 * 2. Selection mode: redistribute specific selected images (requires 'imageIds')
 */
export async function POST({ request, locals }: RequestEvent) {
  const { log, logContext } = locals;
  if (!dev) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  let payload: RedistributePayload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { dayId, location, imageIds, contentDir } = payload;

  if (!dayId) {
    return json({ message: "Missing dayId" }, { status: 400 });
  }

  // Must have either location OR imageIds
  if (!location && (!imageIds || imageIds.length < 2)) {
    return json(
      { message: "Must provide either 'location' or 'imageIds' (minimum 2 images)" },
      { status: 400 },
    );
  }

  const resolvedContentDir = contentDir || process.env.CONTENT_DIR;
  if (!resolvedContentDir) {
    return json({ message: "Content directory not specified" }, { status: 400 });
  }

  const dataPath = path.resolve(process.cwd(), "src/data", resolvedContentDir);
  const contentDirRoot = path.resolve(process.cwd(), "content", resolvedContentDir);
  const errors: string[] = [];
  let redistributedCount = 0;

  try {
    await withManifestLock(dataPath, async () => {
      const manifest = await loadImagesManifest(dataPath);
      if (!manifest) {
        errors.push(`Manifest not found for ${resolvedContentDir}`);
        return;
      }

      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day-${dayId}`;

      const targetDay = manifest.photoDays.find(
        (day) => day.id === normalizedDayId || day.date === dayId.replace("day-", ""),
      );

      if (!targetDay) {
        errors.push(`Day ${dayId} not found in manifest`);
        return;
      }

      // Get images based on mode
      let targetImages: ImageEntry[];

      if (imageIds && imageIds.length > 0) {
        // Selection mode: use specific image IDs
        targetImages = targetDay.items.filter(
          (item) => item.type !== "separator" && imageIds.includes(item.id),
        ) as ImageEntry[];

        if (targetImages.length < 2) {
          errors.push(
            `Not enough images found from selection (found ${targetImages.length}, need at least 2)`,
          );
          return;
        }
      } else if (location) {
        // Location mode: use all images in location
        targetImages = targetDay.items.filter(
          (item) => item.type !== "separator" && (item as ImageEntry).exif?.location === location,
        ) as ImageEntry[];

        if (targetImages.length < 2) {
          errors.push(
            `Not enough images found for location "${location}" on day ${dayId} to redistribute`,
          );
          return;
        }
      } else {
        errors.push("Invalid payload: must provide either location or imageIds");
        return;
      }

      // Sort images by current releaseDate/date to respect current visual order
      const sortedImages = [...targetImages].sort((a, b) => {
        const timeA = a.exif?.releaseDate || a.exif?.date || "";
        const timeB = b.exif?.releaseDate || b.exif?.date || "";
        return timeA.localeCompare(timeB);
      });

      // Group items by sequence (or individual image if not in sequence)
      // This is crucial: we want to distribute *logical items*, not every single file individually if they are part of a sequence.
      // If a sequence has 5 photos, it should take up only 1 "slot" in the time distribution.
      const groupedEntities = new Map<string, ImageEntry[]>();
      for (const item of sortedImages) {
        const key = item.sequenceInfo?.baseId || item.id;
        if (!groupedEntities.has(key)) {
          groupedEntities.set(key, []);
        }
        groupedEntities.get(key)?.push(item);
      }

      // We need to pass representative items to distributeTimesInRange
      // The representative item is the one with the earliest time (usually the first one in the sorted array)
      const representativeItems: ImageEntry[] = [];
      for (const group of groupedEntities.values()) {
        // Sort group internally by time just to be safe
        group.sort((a, b) => {
          const tA = a.exif?.releaseDate || a.exif?.date || "";
          const tB = b.exif?.releaseDate || b.exif?.date || "";
          return tA.localeCompare(tB);
        });
        representativeItems.push(group[0]);
      }

      // Calculate effective bounds on the *representative* items
      // (This should be roughly the same as total bounds, but logically cleaner)
      const minTime =
        representativeItems[0].exif?.releaseDate || representativeItems[0].exif?.date || "";
      const maxTime =
        representativeItems[representativeItems.length - 1].exif?.releaseDate ||
        representativeItems[representativeItems.length - 1].exif?.date ||
        "";

      if (!minTime || !maxTime) {
        errors.push(`Unable to determine time bounds for images`);
        return;
      }

      if (minTime === maxTime) {
        errors.push(`Start time equals end time (${minTime}), cannot redistribute.`);
        return;
      }

      log.info(
        {
          count: representativeItems.length,
          totalImages: sortedImages.length,
          mode: imageIds ? "selection" : "location",
          location: location || undefined,
          imageIds: imageIds || undefined,
          minTime,
          maxTime,
        },
        "Redistributing entities",
      );

      // Distribute times for representative items
      const newRepresentativeDates = distributeTimesInRange(representativeItems, minTime, maxTime);

      // Now map these dates back to ALL items in the groups
      const allNewDates: Record<string, string> = {};

      for (const [repId, newDate] of Object.entries(newRepresentativeDates)) {
        // Find the group this repId belongs to
        // (We can use the repId as key if it equals the baseId for single items, but for sequences repId != baseId necessarily)
        // Actually, we can just look up which group contains the item with repId.
        const groupKey =
          representativeItems.find((i) => i.id === repId)?.sequenceInfo?.baseId || repId;
        const group = groupedEntities.get(groupKey);

        if (group) {
          // Assign the SAME new releaseDate to ALL items in the sequence group
          // This keeps they grouped together at the same timestamp.
          // The sort order within the sequence is determined by their original capture time (date), which isn't changing.
          // releaseDate overrides sorting in PhotoGrid, but if they are equal, it might fall back to ID or date?
          // Ideally, for sequences, we want them to have the same releaseDate.
          for (const item of group) {
            allNewDates[item.id] = newDate;
          }
        }
      }

      // Write to files (XMP) and update manifest objects
      for (const [id, releaseDate] of Object.entries(allNewDates)) {
        const imagePath = await resolveImagePath(id, contentDirRoot);

        // Write XMP
        if (imagePath) {
          await exiftool.write(imagePath, {
            "XMP:ReleaseDate": releaseDate,
          } as WriteTags);
        } else {
          log.warn({ imageId: id }, "Could not resolve path for image, skipping XMP write");
        }

        // Update manifest object in memory
        const imageItem = targetDay.items.find((i) => i.id === id) as ImageEntry | undefined;
        if (imageItem) {
          if (!imageItem.exif) imageItem.exif = {} as ImageEntry["exif"];
          if (imageItem.exif) imageItem.exif.releaseDate = releaseDate;
        }

        redistributedCount++;
      }

      // Re-organize the day (generates separators, sorts items)
      const storyData = await loadStoryData(contentDirRoot);
      const newDay = organizeDayItems(targetDay, storyData);
      const dayIndex = manifest.photoDays.findIndex((d) => d.id === targetDay.id);
      if (dayIndex !== -1) {
        manifest.photoDays[dayIndex] = newDay;
      }

      await saveImagesManifest(dataPath, manifest);
    });

    await reloadManifests();
    logContext.location = location;
    logContext.redistributedCount = redistributedCount;
  } catch (error) {
    log.error({ err: error }, "Redistribute failed");
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  return json({
    success: true,
    redistributed: redistributedCount,
    location,
    dayId,
    errors: errors.length > 0 ? errors : undefined,
  });
}

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

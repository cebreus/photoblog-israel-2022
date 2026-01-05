import path from "node:path";
import process from "node:process";
import { json, type RequestEvent } from "@sveltejs/kit";
import { exiftool, type WriteTags } from "exiftool-vendored";
import { dev } from "$app/environment";
import type { ImageEntry } from "$lib/types/manifest";
import { reloadManifests } from "$lib/utils/images";
import { organizeDayItems } from "$scripts/lib/manifests/builder";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import { loadImagesManifest, saveImagesManifest } from "$scripts/lib/manifests/repository";
import { distributeTimesInRange } from "$shared/utils/sorting";
import { loadStoryData } from "../reorder/loader";

type RedistributePayload = {
  dayId: string;
  location: string;
  contentDir?: string;
};

/**
 * POST /api/images/redistribute
 * Redistributes images in a location evenly across the location's time bounds.
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

  const { dayId, location, contentDir } = payload;

  if (!dayId || !location) {
    return json({ message: "Missing dayId or location" }, { status: 400 });
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

      // Get images from this location
      const locationImages = targetDay.items.filter(
        (item) => item.type !== "separator" && (item as ImageEntry).exif?.location === location,
      ) as ImageEntry[];

      if (locationImages.length < 2) {
        errors.push(
          `Not enough images found for location "${location}" on day ${dayId} to redistribute`,
        );
        return;
      }

      // Sort images by current releaseDate/date to respect current visual order
      const sortedImages = [...locationImages].sort((a, b) => {
        const timeA = a.exif?.releaseDate || a.exif?.date || "";
        const timeB = b.exif?.releaseDate || b.exif?.date || "";
        return timeA.localeCompare(timeB);
      });

      // Calculate effective bounds from minimum and maximum times in the set
      // Since we sort above, first is min, last is max
      const minTime = sortedImages[0].exif?.releaseDate || sortedImages[0].exif?.date || "";
      const maxTime =
        sortedImages[sortedImages.length - 1].exif?.releaseDate ||
        sortedImages[sortedImages.length - 1].exif?.date ||
        "";

      if (!minTime || !maxTime) {
        errors.push(`Unable to determine time bounds for location "${location}"`);
        return;
      }

      if (minTime === maxTime) {
        errors.push(`Start time equals end time (${minTime}), cannot redistribute.`);
        return;
      }

      log.info(
        { count: sortedImages.length, location, minTime, maxTime },
        "Redistributing images in location",
      );

      // Calculate new evenly distributed times
      const newDates = distributeTimesInRange(sortedImages, minTime, maxTime);

      // Write to files (XMP) and update manifest objects
      for (const [id, releaseDate] of Object.entries(newDates)) {
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
  const extensions = [".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG", ".heic", ".HEIC"];
  const searchPaths = [
    path.join(contentDirRoot, "pics"),
    path.join(contentDirRoot, "pics", "collage-sources"),
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

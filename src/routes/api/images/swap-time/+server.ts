import path from "node:path";
import process from "node:process";
import { json, type RequestEvent } from "@sveltejs/kit";
import { exiftool, type WriteTags } from "exiftool-vendored";
import { dev } from "$app/environment";
import type { ImageEntry } from "$lib/types/manifest";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { organizeDayItems } from "$scripts/lib/manifests/builder";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import { loadImagesManifest, saveImagesManifest } from "$scripts/lib/manifests/repository";
import { fileExists } from "$scripts/lib/utils/runtime";
import { addSecondsToIsoString, diffIsoStringsInSeconds } from "$shared/utils/dates";
import { loadStoryData } from "../reorder/loader";

type SwapTimePayload = {
  dayId: string;
  imageIds: string[]; // Array of IDs (can be 2+ if sequences are involved)
  contentDir?: string;
};

/**
 * POST /api/images/swap-time
 * Swaps release dates between two logical entities (single images or sequences).
 * Uses pure string-based date manipulation to avoid timezone issues.
 */
export async function POST({ request, locals }: RequestEvent) {
  const { log, logContext } = locals;
  if (!dev) {
    return json({ message: "Forbidden" }, { status: 403 });
  }

  let payload: SwapTimePayload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { dayId, imageIds, contentDir } = payload;

  if (!dayId || !imageIds || !Array.isArray(imageIds) || imageIds.length < 2) {
    return json(
      { message: "Invalid payload: need dayId and at least 2 imageIds" },
      { status: 400 },
    );
  }

  const resolvedContentDir = contentDir || process.env.CONTENT_DIR;
  if (!resolvedContentDir) {
    return json({ message: "Content directory not specified" }, { status: 400 });
  }

  const dataPath = path.resolve(process.cwd(), "src/data", resolvedContentDir);
  const contentDirRoot = path.resolve(process.cwd(), "content", resolvedContentDir);

  try {
    await withManifestLock(dataPath, async () => {
      const manifest = await loadImagesManifest(dataPath);
      if (!manifest) throw new Error(`Manifest not found for ${resolvedContentDir}`);

      const normalizedDayId = dayId.startsWith("day-") ? dayId : `day-${dayId}`;
      const targetDay = manifest.photoDays.find(
        (day) => day.id === normalizedDayId || day.date === dayId.replace("day-", ""),
      );

      if (!targetDay) throw new Error(`Day ${dayId} not found in manifest`);

      // 1. Resolve Items
      const selectedItems = imageIds
        .map((id) => targetDay.items.find((i) => i.id === id) as ImageEntry | undefined)
        .filter((i): i is ImageEntry => !!i);

      if (selectedItems.length !== imageIds.length) {
        throw new Error("Some images not found in day");
      }

      // 2. Group into Entities (Logical Blocks by baseId)
      const entities = new Map<string, ImageEntry[]>();

      for (const item of selectedItems) {
        const key = item.sequenceInfo?.baseId || item.id;
        if (!entities.has(key)) {
          entities.set(key, []);
        }
        entities.get(key)?.push(item);
      }

      if (entities.size !== 2) {
        throw new Error(
          `Swap requires exactly 2 logical entities (photos or sequences). Selected: ${entities.size}`,
        );
      }

      const [entityA, entityB] = Array.from(entities.values());

      // 3. Get base times (earliest releaseDate in each entity) - AS STRINGS
      const getBaseTime = (items: ImageEntry[]): string | null => {
        const times = items
          .map((i) => i.exif?.releaseDate || i.exif?.date || "")
          .filter((t) => t)
          .sort();
        return times[0] || null;
      };

      const baseTimeA = getBaseTime(entityA);
      const baseTimeB = getBaseTime(entityB);

      if (!baseTimeA || !baseTimeB) throw new Error("Could not determine base times for swapping");

      // 4. Calculate the shift (in seconds, as pure number from string diff)
      // Shift for A = how many seconds to move A's items so A starts at B's time
      const shiftASeconds = diffIsoStringsInSeconds(baseTimeA, baseTimeB);
      // Shift for B is the opposite
      const shiftBSeconds = -shiftASeconds;

      log.info(
        {
          entityACount: entityA.length,
          baseTimeA,
          entityBCount: entityB.length,
          baseTimeB,
          shiftSeconds: shiftASeconds,
        },
        "Swapping entities",
      );

      // 5. Apply Shifts (string-based arithmetic)
      const updates: { item: ImageEntry; newDate: string }[] = [];

      const processEntity = (items: ImageEntry[], shiftSeconds: number) => {
        for (const item of items) {
          const currentTime = item.exif?.releaseDate || item.exif?.date;
          if (!currentTime) continue;

          const newTime = addSecondsToIsoString(currentTime, shiftSeconds);
          if (newTime) {
            updates.push({ item, newDate: newTime });
          }
        }
      };

      processEntity(entityA, shiftASeconds);
      processEntity(entityB, shiftBSeconds);

      // 6. Execute Writes to files and update manifest
      for (const update of updates) {
        const { item, newDate } = update;
        const filePath = await resolveImagePath(item.id, contentDirRoot);

        if (filePath) {
          await exiftool.write(filePath, { "XMP:ReleaseDate": newDate } as WriteTags);
        }

        // Update manifest in memory
        if (!item.exif) item.exif = {} as ImageEntry["exif"];
        if (item.exif) item.exif.releaseDate = newDate;
      }

      // Re-organize day (sort by new times)
      const storyData = await loadStoryData(contentDirRoot);
      const newDay = organizeDayItems(targetDay, storyData);
      const dayIndex = manifest.photoDays.findIndex((d) => d.id === targetDay.id);
      if (dayIndex !== -1) manifest.photoDays[dayIndex] = newDay;

      await saveImagesManifest(dataPath, manifest);
    });

    await reloadManifests();

    logContext.imageIdsCount = imageIds.length;
    return json({ success: true, swapped: true });
  } catch (error) {
    log.error({ err: error }, "Swap failed");
    return json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

async function resolveImagePath(imageId: string, contentDirRoot: string): Promise<string | null> {
  const extensions = [".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG", ".heic", ".HEIC"];
  const searchPaths = [
    path.join(contentDirRoot, "pics"),
    path.join(contentDirRoot, "pics", "collage-sources"),
  ];

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

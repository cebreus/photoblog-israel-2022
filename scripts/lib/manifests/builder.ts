/**
 * @fileoverview Manifest builder utilities for images and site.
 *
 * @description
 * Utilities to construct and write manifests used by the site and generator.
 */
import { createLogger } from "$scripts/core/cli-logger";
import { detectSequences } from "$scripts/image/sequence-detector";
import * as SeparatorService from "$scripts/separators/service";
import {
  ImageFormat,
  createEmptyVariants,
  isRecognizedFormat,
  normalizeFormat,
} from "$shared/types/images";
import type {
  ImageEntry,
  Manifest,
  MenuManifest,
  PhotoDay,
  Separator,
  StoryDataMap,
} from "$shared/types/manifest";
import { toSlug } from "$shared/utils/strings";
import path from "node:path";
import { config } from "../../build.config";

const logger = createLogger("manifest-builder");

type GeneratorVariant = {
  path: string;
  width: number | null | undefined;
  height: number | null | undefined;
};

type GeneratorManifestEntry = {
  original: {
    format: string;
    height: number | null | undefined;
    path: string;
    width: number | null | undefined;
  };
  variants: ReturnType<typeof createEmptyVariants<GeneratorVariant>>;
  placeholder: {
    width: number | null;
    height: number | null;
    type: string | null;
  } | null;
  color: string | null | undefined;
  outputs: string[];
};

function compareVariantsByWidth(a: GeneratorVariant, b: GeneratorVariant): number {
  const leftWidth = a.width ?? 0;
  const rightWidth = b.width ?? 0;
  if (leftWidth === rightWidth) {
    return (a.path || "").localeCompare(b.path || "");
  }
  return leftWidth - rightWidth;
}

function sortGeneratorVariants(list: GeneratorVariant[]): GeneratorVariant[] {
  return [...list].sort(compareVariantsByWidth);
}

function compareStringsAlphabetically(a: string, b: string): number {
  return a.localeCompare(b);
}

export type ProcessedImageResult = {
  key: string;
  outputs: string[];
  image: ImageEntry;
};

export function buildGeneratorManifest(
  results: ProcessedImageResult[],
): Record<string, GeneratorManifestEntry> {
  const manifest: Record<string, GeneratorManifestEntry> = {};

  for (const res of results) {
    if (!res) continue;
    const baseName = path.basename(res.key);
    const ext = path.extname(res.key).slice(1).toLowerCase();

    const grouped = createEmptyVariants<GeneratorVariant>();

    for (const src of res.image.sources || []) {
      const [, subtypeRaw] = src.type.split("/");
      const subtype = normalizeFormat(subtypeRaw);
      if (isRecognizedFormat(subtype)) {
        grouped[subtype].push({
          path: src.path,
          width: src.width ?? null,
          height: src.height ?? null,
        });
      }
    }

    manifest[baseName] = {
      original: {
        format: ext,
        height: res.image.height,
        path: baseName,
        width: res.image.width,
      },
      variants: {
        [ImageFormat.AVIF]: sortGeneratorVariants(grouped[ImageFormat.AVIF]),
        [ImageFormat.WEBP]: sortGeneratorVariants(grouped[ImageFormat.WEBP]),
        [ImageFormat.JPEG]: sortGeneratorVariants(grouped[ImageFormat.JPEG]),
      },
      placeholder: res.image.placeholder ? { width: null, height: null, type: null } : null,
      color: res.image.placeholderColor,
      outputs: [...res.outputs].sort(compareStringsAlphabetically),
    };
  }

  return manifest;
}

function clonePhotoDay(day: PhotoDay): PhotoDay {
  return { ...day, items: [...(day.items || [])] };
}

function removeDeletedKeysFromDay(day: PhotoDay, deletedKeys: string[]): void {
  day.items = (day.items || []).filter((item) => {
    if (item.type === "separator") return true;
    return !deletedKeys.some((key) => item.src.startsWith(path.basename(key, path.extname(key))));
  });
}

function removeImagesStartingWith(day: PhotoDay, baseNameWithoutExt: string): void {
  day.items = day.items.filter((item) => {
    if (item.type === "separator") return true;
    return !item.src.startsWith(baseNameWithoutExt);
  });
}

function isImage(item: ImageEntry | Separator): item is ImageEntry {
  return (
    item.type === "image" ||
    item.type === "sequence" ||
    item.type === "sequence-member" ||
    item.type === "panorama" ||
    item.type === "collage"
  );
}

function getImageDate(image: ImageEntry): string | undefined {
  return (image.exif?.releaseDate ?? image.exif?.date)?.substring(0, 10);
}

function getItemTimestamp(item: ImageEntry | Separator): string {
  if (item.type === "separator") {
    // Separator timestamps are always strings (normalized in loadStoryData)
    return item.startDate || item.endDate || "";
  }
  // Image timestamps are always strings (from EXIF processing)
  return item.exif?.releaseDate ?? item.exif?.date ?? "";
}

function compareItemsByTimestamp(a: ImageEntry | Separator, b: ImageEntry | Separator): number {
  const tsA = getItemTimestamp(a);
  const tsB = getItemTimestamp(b);
  if (!tsA && !tsB) return 0;
  if (!tsA) return 1;
  if (!tsB) return -1;
  return tsA.localeCompare(tsB);
}

type GeoMetadata = {
  cities: string[];
  locations: string[];
  seenCities: Set<string>;
  seenLocations: Set<string>;
};

function createGeoMetadata(): GeoMetadata {
  return {
    cities: [],
    locations: [],
    seenCities: new Set<string>(),
    seenLocations: new Set<string>(),
  };
}

function accumulateGeoMetadata(geo: GeoMetadata, image: ImageEntry): void {
  const city = image.exif?.city;
  if (city && !geo.seenCities.has(city)) {
    geo.seenCities.add(city);
    geo.cities.push(city);
  }

  const location = image.exif?.location;
  if (location && !geo.seenLocations.has(location)) {
    geo.seenLocations.add(location);
    geo.locations.push(location);
  }
}

export function organizeDayItems(day: PhotoDay, storyData: StoryDataMap): PhotoDay {
  const images = (day.items || []).filter(isImage);
  const imagesByLocation = SeparatorService.groupImagesByLocation(images);
  const seenLocationsWithMarkdown = new Set<string>();
  const allItems: (ImageEntry | Separator)[] = [];

  // 1. Add all markdown-defined separators for this day (including multiple visits)
  const markdownSeparators = SeparatorService.getMarkdownSeparatorsForDay(day.date, storyData);
  for (const sep of markdownSeparators) {
    allItems.push(sep);
    seenLocationsWithMarkdown.add(sep.location);
  }

  // 2. Process images and add them, plus auto-separators for locations WITHOUT markdown separators
  const seenLocationsAuto = new Set<string>();
  for (const image of images) {
    const location = image.exif?.location || "Unknown";
    const group = imagesByLocation[location] || [];

    // Create auto-separator only if not defined in markdown AND not already seen auto-separator
    if (!seenLocationsWithMarkdown.has(location) && !seenLocationsAuto.has(location)) {
      const autoSeparator = SeparatorService.createAutoSeparator(location, group);

      if (autoSeparator) {
        allItems.push(autoSeparator);
        seenLocationsAuto.add(location);

        // WARN: This shouldn't happen if markdown separators exist
        logger.warn(
          { location, date: day.date },
          `Auto-separator created for "${location}" on ${day.date}. This indicates markdown separators might not be covering all photos.`,
        );
      }
    }

    allItems.push(image);
  }

  // 3. Sort all items by timestamp (unified sorting)
  allItems.sort(compareItemsByTimestamp);

  // 4. Collect geo metadata in CHRONOLOGICAL order from sorted items
  const geo = createGeoMetadata();

  // 5. Assign photos to separators using explicit time-based matching
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item.type === "separator") {
      const updatedSeparator = SeparatorService.assignPhotos(item, images);
      allItems[i] = updatedSeparator;

      // VALIDATION: Warn about separators with explicit dates but no photos
      if (
        !updatedSeparator.hasPhotos &&
        (updatedSeparator.startDate || updatedSeparator.endDate) &&
        updatedSeparator.source !== "visit"
      ) {
        // Count photos manually for warning message
        let photoCount = 0;
        for (const photo of images) {
          const photoLocation = photo.exif?.location || "Unknown";
          const photoTimestamp = photo.exif?.releaseDate ?? photo.exif?.date;

          if (photoLocation !== updatedSeparator.location) continue;

          if (updatedSeparator.startDate || updatedSeparator.endDate) {
            if (!photoTimestamp) continue;
            const start = updatedSeparator.startDate || "1970-01-01T00:00:00";
            const end = updatedSeparator.endDate || "9999-12-31T23:59:59";
            if (photoTimestamp >= start && photoTimestamp <= end) {
              photoCount++;
            }
          } else {
            photoCount++;
          }
        }

        const ctx = {
          location: updatedSeparator.location,
          date: day.date,
          photoCount,
          start: updatedSeparator.startDate || "N/A",
          end: updatedSeparator.endDate || "N/A",
        };

        logger.warn(
          { ctx },
          `Separator "${updatedSeparator.location}" on ${day.date} has explicit start/end dates but ${photoCount} photo(s) (need >=${config.separator.minPhotosForDisplay}).`,
        );
      }
    }
  }

  // 5. Collect geo metadata in CHRONOLOGICAL order from sorted and matched items
  for (const item of allItems) {
    if (isImage(item)) {
      accumulateGeoMetadata(geo, item);
    } else if (item.type === "separator") {
      if (item.location && !geo.seenLocations.has(item.location)) {
        geo.locations.push(item.location);
        geo.seenLocations.add(item.location);
      }
      if (item.city && !geo.seenCities.has(item.city)) {
        geo.seenCities.add(item.city);
        geo.cities.push(item.city);
      }
    }
  }

  return {
    date: day.date,
    cities: geo.cities,
    locations: geo.locations,
    story: storyData[day.date]?.content,
    items: allItems,
    id: day.id || `day-${day.date}`,
  };
}
function hasItems(day: PhotoDay): boolean {
  return day.items.length > 0;
}

function compareByDate(a: PhotoDay, b: PhotoDay): number {
  return a.date.localeCompare(b.date);
}

function findDayByDate(photoDays: PhotoDay[], targetDate: string): PhotoDay | undefined {
  return photoDays.find((day) => day.date === targetDate);
}

export function updateManifest(
  results: ProcessedImageResult[],
  deletedKeys: string[],
  storyData: StoryDataMap,
  existingManifest: Manifest,
): Manifest {
  const manifest: Manifest = {
    photoDays: existingManifest.photoDays.map(clonePhotoDay),
  };

  for (const day of manifest.photoDays) {
    removeDeletedKeysFromDay(day, deletedKeys);
  }
  manifest.photoDays = manifest.photoDays.filter(hasItems);

  const resultsByDate: Record<string, ProcessedImageResult[]> = {};

  // 1. Group new results by date
  for (const result of results) {
    if (!result) continue;
    const date = getImageDate(result.image);
    if (!date) continue;
    if (!resultsByDate[date]) resultsByDate[date] = [];
    resultsByDate[date].push(result);
  }

  // 1b. Remove images from ALL days before merging (fixes stale entries when releaseDate changes)
  // This ensures that if an image moves from one day to another, the old entry is removed

  for (const result of results) {
    if (!result) continue;
    const baseNameWithoutExt = path.basename(result.key, path.extname(result.key));

    for (const day of manifest.photoDays) {
      removeImagesStartingWith(day, baseNameWithoutExt);
    }
  }

  // 2. Merge new results into the manifest
  for (const [date, dayResults] of Object.entries(resultsByDate)) {
    let day = findDayByDate(manifest.photoDays, date);
    if (!day) {
      day = { date, items: [], id: `day-${date}` };
      manifest.photoDays.push(day);
    }

    // Re-classify existing items in this day
    for (const item of day.items) {
      if (item.type === "image" && item.id.includes("--collage")) {
        item.type = "collage";
      }
    }

    for (const result of dayResults) {
      day.items.push(result.image);
    }
  }

  // 3. Detect sequences across the ENTIRE manifest to ensure consistent grouping
  const allImages: ImageEntry[] = [];
  const imageMap = new Map<string, ImageEntry>();

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (isImage(item)) {
        allImages.push(item);
        imageMap.set(item.id, item);
      }
    }
  }

  const globalSequenceMap = detectSequences(allImages);

  for (const [id, seqInfo] of globalSequenceMap) {
    const image = imageMap.get(id);
    if (image) {
      image.sequenceInfo = seqInfo;
      // Ensure type reflects sequence status (representative vs member)
      if (seqInfo.index === seqInfo.total) {
        image.type = "sequence";
      } else {
        image.type = "sequence-member";
      }
    }
  }

  // 4. Force sequence members into the same day as their representative
  // This handles cases where sequence members might have dates crossing midnight
  for (const image of allImages) {
    if (image.sequenceInfo && image.type === "sequence-member") {
      const repId = image.sequenceInfo.members?.find((mId) => {
        const m = imageMap.get(mId);
        return m?.type === "sequence";
      });

      if (repId) {
        const representative = imageMap.get(repId);
        const repDayDate = representative ? getImageDate(representative) : null;
        const currentDayDate = getImageDate(image);

        if (repDayDate && currentDayDate && repDayDate !== currentDayDate) {
          // Move image to representative's day in the manifest
          // 1. Remove from current day
          for (const day of manifest.photoDays) {
            day.items = day.items.filter((item) => item.id !== image.id);
          }
          // 2. Add to representative's day
          let targetDay = findDayByDate(manifest.photoDays, repDayDate);
          if (!targetDay) {
            targetDay = { date: repDayDate, items: [], id: `day-${repDayDate}` };
            manifest.photoDays.push(targetDay);
          }
          targetDay.items.push(image);
        }
      }
    }
  }

  manifest.photoDays = manifest.photoDays.filter(hasItems);

  // Inject PhotoDays for orphan separators (locations with startDate/visits but no photos)
  for (const [locationKey, story] of Object.entries(storyData)) {
    if (story.location !== locationKey) continue;

    const datesToCheck = [];
    if (story.startDate || story.endDate) {
      datesToCheck.push({ startDate: story.startDate, endDate: story.endDate });
    }
    if (story.visits) {
      for (const v of story.visits) {
        datesToCheck.push(v);
      }
    }

    for (const v of datesToCheck) {
      const bestDate = v.startDate || v.endDate;
      if (!bestDate) continue;

      let dayDate = "";
      if (typeof bestDate === "string") {
        dayDate = bestDate.substring(0, 10);
      } else {
        dayDate = (bestDate as Date).toISOString().substring(0, 10);
      }

      let day = findDayByDate(manifest.photoDays, dayDate);
      if (!day) {
        day = { date: dayDate, items: [], id: `day-${dayDate}` };
        manifest.photoDays.push(day);
      }
    }
  }

  function callOrganize(day: PhotoDay) {
    return organizeDayItems(day, storyData);
  }

  manifest.photoDays = manifest.photoDays.map(callOrganize);
  manifest.photoDays.sort(compareByDate);

  return manifest;
}

export function generateMenuManifest(manifest: Manifest, storyData: StoryDataMap): MenuManifest {
  const menu: MenuManifest = [];
  for (const day of manifest.photoDays) {
    menu.push(mapDayToMenu(day, storyData));
  }
  return menu;
}

function mapDayToMenu(d: PhotoDay, storyData: StoryDataMap): MenuManifest[number] {
  const dayId = String(d.id || d.date).startsWith("day-")
    ? String(d.id || d.date)
    : `day-${String(d.id || d.date)}`;

  const locations: MenuManifest[number]["locations"] = [];
  const seenIds = new Set<string>();

  // Identify locations covered by separators (to avoid creating duplicates for images)
  const separatorLocations = new Set(
    d.items.filter((i): i is Separator => i.type === "separator").map((s) => s.location),
  );

  for (const item of d.items) {
    if (item.type === "separator") {
      if (seenIds.has(item.id)) continue;

      const matchingPhotos: ImageEntry[] = [];
      const location = item.location;
      const start = item.startDate || "1970-01-01T00:00:00";
      const end = item.endDate || "9999-12-31T23:59:59";

      for (const photo of d.items) {
        if (!isImage(photo)) continue;
        if (photo.exif?.location !== location) continue;

        if (item.startDate || item.endDate) {
          const ts = photo.exif?.releaseDate ?? photo.exif?.date;
          if (!ts || ts < start || ts > end) continue;
        }
        matchingPhotos.push(photo);
      }

      const firstPhoto = matchingPhotos[0];

      // Find first photo with GPS data for map integration
      const photoWithGPS = matchingPhotos.find(
        (p) => p.exif?.latitude !== undefined && p.exif?.longitude !== undefined,
      );

      locations.push({
        id: item.id,
        label: item.location,
        href: `/#${item.id}`,
        isDimmed: !item.hasPhotos,
        firstPhotoExifDate: firstPhoto?.exif?.releaseDate ?? firstPhoto?.exif?.date,
        startDate: item.startDate ?? storyData[item.location]?.startDate,
        endDate: item.endDate ?? storyData[item.location]?.endDate,
        // 🆕 GPS data for map integration
        latitude: photoWithGPS?.exif?.latitude,
        longitude: photoWithGPS?.exif?.longitude,
        mapLocationId:
          photoWithGPS?.exif?.location ||
          (photoWithGPS?.exif?.latitude !== undefined &&
            photoWithGPS?.exif?.longitude !== undefined &&
            photoWithGPS.exif)
            ? `${(photoWithGPS.exif.latitude as number).toFixed(4)},${(photoWithGPS.exif.longitude as number).toFixed(4)}`
            : undefined,
      });
      seenIds.add(item.id);
    } else if (isImage(item)) {
      const loc = item.exif?.location;
      if (!loc || loc === "Unknown") continue;

      // Skip if this location is handled by a separator
      if (separatorLocations.has(loc)) continue;

      const locId = `loc-${toSlug(loc)}`;
      if (seenIds.has(locId)) continue;

      // This location has no separator (uncommon, usually dimmed)
      const matchingPhotos: ImageEntry[] = [];
      for (const photo of d.items) {
        if (!isImage(photo)) continue;
        if (photo.exif?.location !== loc) continue;
        matchingPhotos.push(photo);
      }

      const isDimmed = matchingPhotos.length <= 2;

      // Check if this location has GPS (from the founding image)
      const hasGPS = item.exif?.latitude !== undefined && item.exif?.longitude !== undefined;

      locations.push({
        id: locId,
        label: loc,
        href: `/#${item.id}`, // Link to the first image we found
        isDimmed,
        firstPhotoExifDate: item.exif?.releaseDate ?? item.exif?.date,
        // No explicit start/end dates for pure image groups
        // 🆕 GPS data for map integration
        latitude: hasGPS ? item.exif?.latitude : undefined,
        longitude: hasGPS ? item.exif?.longitude : undefined,
        mapLocationId:
          hasGPS && item.exif?.latitude && item.exif?.longitude
            ? item.exif?.location ||
              `${item.exif.latitude.toFixed(4)},${item.exif.longitude.toFixed(4)}`
            : undefined,
      });
      seenIds.add(locId);
    }
  }

  return {
    id: dayId,
    date: d.date,
    label: new Date(d.date).toLocaleDateString("cs-CZ", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    href: `/#${dayId}`,
    locations,
  };
}

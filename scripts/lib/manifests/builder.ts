import path from "node:path";
import { marked } from "marked";
import { config } from "$scripts/build.config";
import { detectSequences } from "$scripts/lib/image/sequence-detector";
import type {
  ImageEntry,
  Manifest,
  MenuManifest,
  PhotoDay,
  Separator,
  StoryData,
  StoryDataMap,
} from "$shared/types/manifest";
import { toSlug } from "$shared/utils/strings";

function parseMarkdown(content: string): string {
  const parsed = marked.parse(content);
  return typeof parsed === "string" ? parsed : "";
}

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
  variants: {
    avif: GeneratorVariant[];
    webp: GeneratorVariant[];
    jpeg: GeneratorVariant[];
  };
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

    const grouped: GeneratorManifestEntry["variants"] = {
      avif: [],
      webp: [],
      jpeg: [],
    };

    for (const src of res.image.sources || []) {
      const [, subtype] = src.type.split("/");
      if (subtype === "avif" || subtype === "webp" || subtype === "jpeg") {
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
        avif: sortGeneratorVariants(grouped.avif),
        webp: sortGeneratorVariants(grouped.webp),
        jpeg: sortGeneratorVariants(grouped.jpeg),
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
    item.type === "panorama"
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

function groupImagesByLocation(images: ImageEntry[]): Record<string, ImageEntry[]> {
  const groups: Record<string, ImageEntry[]> = {};

  for (const image of images) {
    const location = image.exif?.location || "Unknown";
    if (!groups[location]) groups[location] = [];
    groups[location].push(image);
  }

  return groups;
}

function createSeparatorFromVisit(
  location: string,
  story: StoryData | undefined,
  startDate?: string,
  endDate?: string,
  city: string = "",
): Separator {
  const storyContent = story?.content?.trim();
  // Unique ID for each visit to avoid duplicates in menu/grid
  // We use the time part (preferring start, falling back to end) to differentiate visits
  const bestTimestamp = startDate || endDate;
  const timeSuffix = bestTimestamp?.includes("T")
    ? `-${bestTimestamp.split("T")[1].substring(0, 5).replace(":", "")}`
    : "";

  return {
    id: `loc-${toSlug(location)}${timeSuffix}`,
    type: "separator",
    location,
    city,
    startDate,
    endDate,
    ...(story && storyContent
      ? {
          storyTitle: story.title,
          story: parseMarkdown(storyContent),
        }
      : {}),
  };
}

function getMarkdownSeparatorsForDay(
  dayDate: string,
  storyData: StoryDataMap,
  _imagesByLocation: Record<string, ImageEntry[]>,
): Separator[] {
  const separators: Separator[] = [];

  for (const [locationKey, story] of Object.entries(storyData)) {
    // Only process location-specific stories (not day stories)
    if (story.location !== locationKey) continue;

    const addVisit = (start?: string, end?: string) => {
      // Require at least startDate or endDate
      const bestDate = start || end;
      if (!bestDate) return;

      // We only compare the YYYY-MM-DD part
      // Note: All dates are already normalized to strings in loadStoryData
      if (bestDate.substring(0, 10) === dayDate) {
        separators.push(createSeparatorFromVisit(locationKey, story, start, end));
      }
    };

    addVisit(story.startDate, story.endDate);

    if (story.visits) {
      for (const visit of story.visits) {
        addVisit(visit.startDate, visit.endDate);
      }
    }
  }

  return separators;
}

export function organizeDayItems(day: PhotoDay, storyData: StoryDataMap): PhotoDay {
  const images = (day.items || []).filter(isImage);
  const imagesByLocation = groupImagesByLocation(images);
  const geo = createGeoMetadata();
  const seenLocationsWithMarkdown = new Set<string>();
  const allItems: (ImageEntry | Separator)[] = [];

  // 1. Add all markdown-defined separators for this day (including multiple visits)
  const markdownSeparators = getMarkdownSeparatorsForDay(day.date, storyData, imagesByLocation);
  for (const sep of markdownSeparators) {
    allItems.push(sep);
    seenLocationsWithMarkdown.add(sep.location);
    if (sep.location && !geo.seenLocations.has(sep.location)) {
      geo.locations.push(sep.location);
      geo.seenLocations.add(sep.location);
    }
  }

  // 2. Process images and add they, plus auto-separators for locations WITHOUT markdown separators
  const seenLocationsAuto = new Set<string>();
  for (const image of images) {
    accumulateGeoMetadata(geo, image);

    const location = image.exif?.location || "Unknown";
    const group = imagesByLocation[location] || [];

    // Create auto-separator only if not defined in markdown AND not already seen auto-separator
    // Uses config.separator.minPhotosForAutoSeparator (default: 3)
    const isAutoSepEligible =
      location !== "Unknown" &&
      group.length >= config.separator.minPhotosForAutoSeparator &&
      !seenLocationsAuto.has(location);

    if (!seenLocationsWithMarkdown.has(location) && isAutoSepEligible) {
      const ts = image.exif?.releaseDate ?? image.exif?.date;
      const separator = createSeparatorFromVisit(
        location,
        storyData[location],
        ts,
        undefined,
        image.exif?.city,
      );
      allItems.push(separator);
      seenLocationsAuto.add(location);

      // WARN: This shouldn't happen if markdown separators exist
      console.warn(
        `⚠️  Auto-separator created for "${location}" on ${day.date} at ${ts}` +
          `\n   Markdown separators for this day: ${
            markdownSeparators
              .filter((s) => s.location === location)
              .map((s) => s.startDate)
              .join(", ") || "none"
          }` +
          `\n   This indicates markdown separators might not be covering all photos.`,
      );
    }

    allItems.push(image);
  }

  // 3. Sort all items by timestamp (unified sorting)
  allItems.sort(compareItemsByTimestamp);

  // 4. Calculate hasPhotos for separators
  // A separator has photos if it has > 2 images FROM THE SAME LOCATION
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item.type === "separator") {
      item.hasPhotos = false; // Default to false
      const separatorLocation = item.location;
      let photoCount = 0;

      // Look ahead and count photos from the same location
      for (let j = i + 1; j < allItems.length; j++) {
        const next = allItems[j];
        if (next.type === "separator") break; // Stop at next separator
        // At this point, next is an image (not a separator)
        // Check if this image belongs to the SAME location as the separator
        const imageLocation = next.exif?.location || "Unknown";
        if (imageLocation === separatorLocation) {
          photoCount++;
        }
      }

      // Only display separator if it meets the minimum photo threshold
      // Uses config.separator.minPhotosForDisplay (default: 3)
      item.hasPhotos = photoCount >= config.separator.minPhotosForDisplay;

      // VALIDATION: Warn about separators with explicit dates but no photos
      if (!item.hasPhotos && (item.startDate || item.endDate)) {
        console.warn(
          `⚠️  Separator "${separatorLocation}" on ${day.date} has explicit start/end dates but ${photoCount} photo(s) (need >2).` +
            `\n   This might indicate a timezone issue or incorrect photo location metadata.` +
            `\n   Start: ${item.startDate || "N/A"} | End: ${item.endDate || "N/A"}`,
        );
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

  // 2. Merge new results into the manifest
  for (const [date, dayResults] of Object.entries(resultsByDate)) {
    let day = findDayByDate(manifest.photoDays, date);
    if (!day) {
      day = { date, items: [], id: `day-${date}` };
      manifest.photoDays.push(day);
    }

    for (const result of dayResults) {
      const baseNameWithoutExt = path.basename(result.key, path.extname(result.key));
      removeImagesStartingWith(day, baseNameWithoutExt);
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

    const checkAndInject = (v: { startDate?: any; endDate?: any }) => {
      const bestDate = v.startDate || v.endDate;
      if (!bestDate) return;
      const dayDate = (
        bestDate instanceof Date ? bestDate.toISOString() : String(bestDate)
      ).substring(0, 10);
      let day = findDayByDate(manifest.photoDays, dayDate);
      if (!day) {
        day = { date: dayDate, items: [], id: `day-${dayDate}` };
        manifest.photoDays.push(day);
      }
    };

    checkAndInject({ startDate: story.startDate, endDate: story.endDate });
    if (story.visits) {
      for (const v of story.visits) {
        checkAndInject(v);
      }
    }
  }

  manifest.photoDays = manifest.photoDays.map((day) => organizeDayItems(day, storyData));
  manifest.photoDays.sort(compareByDate);

  return manifest;
}

export function generateMenuManifest(manifest: Manifest, storyData: StoryDataMap): MenuManifest {
  return manifest.photoDays.map((day) => mapDayToMenu(day, storyData));
}

function mapLocationToMenuItem(
  locationName: string,
  day: PhotoDay,
  storyData: StoryDataMap,
  separatorId?: string,
): MenuManifest[number]["locations"][number] {
  const group = day.items.filter(
    (item): item is ImageEntry => item.type === "image" && item.exif?.location === locationName,
  );

  const separator = separatorId
    ? day.items.find(
        (item): item is Separator => item.type === "separator" && item.id === separatorId,
      )
    : day.items.find(
        (item): item is Separator => item.type === "separator" && item.location === locationName,
      );

  const locId = separator?.id || `loc-${toSlug(locationName)}`;
  const isDimmed = group.length <= 2;

  let href = `#${locId}`;
  if (isDimmed && group.length > 0) {
    // Fallback to first photo if separator doesn't exist (legacy/auto-separator case)
    if (!separator && group[0]) {
      href = `#${group[0].id}`;
    }
  }

  const firstPhotoExifDate = group[0]?.exif?.date;
  const startDate = separator?.startDate ?? storyData[locationName]?.startDate;
  const endDate = separator?.endDate ?? storyData[locationName]?.endDate;

  return {
    id: locId,
    label: locationName,
    href,
    isDimmed,
    firstPhotoExifDate,
    startDate,
    endDate,
  };
}

function mapDayToMenu(d: PhotoDay, storyData: StoryDataMap): MenuManifest[number] {
  const dayId = String(d.id || d.date).startsWith("day-")
    ? String(d.id || d.date)
    : `day-${String(d.id || d.date)}`;

  const menuEntries: { name: string; id: string }[] = [];
  const seenIds = new Set<string>();
  const locationsWithSeparators = new Set<string>(
    d.items.filter((i): i is Separator => i.type === "separator").map((s) => s.location),
  );

  for (const item of d.items) {
    const location = item.type === "image" ? item.exif?.location : item.location;
    if (!location || location === "Unknown") continue;

    if (item.type === "image") {
      // If this location already has a separator (defined in markdown or auto-generated),
      // the image belongs to it and shouldn't create a new menu entry.
      if (locationsWithSeparators.has(location)) continue;

      const id = `loc-${toSlug(location)}`;
      if (!seenIds.has(id)) {
        menuEntries.push({ name: location, id });
        seenIds.add(id);
      }
    } else if (item.type === "separator") {
      if (!seenIds.has(item.id)) {
        menuEntries.push({ name: location, id: item.id });
        seenIds.add(item.id);
      }
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
    href: `#${dayId}`,
    locations: menuEntries.map((e) => mapLocationToMenuItem(e.name, d, storyData, e.id)),
  };
}

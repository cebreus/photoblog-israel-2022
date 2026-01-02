import path from "node:path";
import { marked } from "marked";
import { detectSequences } from "$scripts/lib/image/sequence-detector";
import type {
  ImageEntry,
  Manifest,
  MenuManifest,
  PhotoDay,
  Separator,
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

function compareByExifDate(a: ImageEntry, b: ImageEntry): number {
  // Priority: exif.releaseDate > exif.date (DateTimeOriginal)
  const dateA = a.exif?.releaseDate ?? a.exif?.date ?? "";
  const dateB = b.exif?.releaseDate ?? b.exif?.date ?? "";
  return dateA.localeCompare(dateB);
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

function shouldCreateSeparator(
  location: string,
  groupSize: number,
  seenLocations: Set<string>,
): boolean {
  return location !== "Unknown" && groupSize > 2 && !seenLocations.has(location);
}

function createLocationSeparator(
  location: string,
  firstImage: ImageEntry,
  storyData: StoryDataMap,
): Separator {
  const story = storyData[location];
  const storyContent = story?.content?.trim();

  return {
    id: `loc-${toSlug(location)}`,
    type: "separator",
    location,
    city: firstImage.exif?.city || "",
    ...(story && storyContent
      ? {
          storyTitle: story.title,
          story: parseMarkdown(storyContent),
        }
      : {}),
  };
}

export function organizeDayItems(day: PhotoDay, storyData: StoryDataMap): PhotoDay {
  const images = (day.items || []).filter(isImage);
  images.sort(compareByExifDate);

  const imagesByLocation = groupImagesByLocation(images);
  const geo = createGeoMetadata();
  const seenLocations = new Set<string>();
  const newItems: (ImageEntry | Separator)[] = [];

  for (const image of images) {
    accumulateGeoMetadata(geo, image);

    const location = image.exif?.location || "Unknown";
    const group = imagesByLocation[location] || [];

    if (shouldCreateSeparator(location, group.length, seenLocations)) {
      const separator = createLocationSeparator(location, group[0], storyData);
      newItems.push(separator);
      seenLocations.add(location);
    }

    newItems.push(image);
  }

  return {
    date: day.date,
    cities: geo.cities,
    locations: geo.locations,
    story: storyData[day.date]?.content,
    items: newItems,
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
    const date = result.image.exif?.date?.substring(0, 10);
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

  manifest.photoDays = manifest.photoDays.map((day) => organizeDayItems(day, storyData));
  manifest.photoDays.sort(compareByDate);

  return manifest;
}

export function generateMenuManifest(manifest: Manifest): MenuManifest {
  return manifest.photoDays.map(mapDayToMenu);
}

function mapLocationToMenuItem(
  locationName: string,
  day: PhotoDay,
): MenuManifest[number]["locations"][number] {
  const group = day.items.filter(
    (item): item is ImageEntry => item.type === "image" && item.exif?.location === locationName,
  );

  const locId = `loc-${toSlug(locationName)}`;
  const isDimmed = group.length <= 2;

  let href = `#${locId}`;
  if (isDimmed && group.length > 0) {
    href = `#${group[0].id}`;
  }

  return {
    id: locId,
    label: locationName,
    href,
    isDimmed,
    firstPhotoExifDate: group[0]?.exif?.date,
  };
}

function mapDayToMenu(d: PhotoDay): MenuManifest[number] {
  const dayId = String(d.id || d.date).startsWith("day-")
    ? String(d.id || d.date)
    : `day-${String(d.id || d.date)}`;

  const locationsInOrder: string[] = [];
  const seenLocations = new Set<string>();

  for (const item of d.items) {
    const location = item.type === "image" ? item.exif?.location : item.location;
    if (location && location !== "Unknown" && !seenLocations.has(location)) {
      locationsInOrder.push(location);
      seenLocations.add(location);
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
    locations: locationsInOrder.map((loc) => mapLocationToMenuItem(loc, d)),
  };
}

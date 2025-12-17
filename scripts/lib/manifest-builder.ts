import { marked } from "marked";
import path from "node:path";
import type {
  ImageEntry,
  Manifest,
  MenuManifest,
  PhotoDay,
  Separator,
  StoryDataMap,
} from "../../src/lib/types/manifest";
import { toSlug } from "../../src/lib/utils/strings";

/**
 * Parses a Markdown string into HTML using marked.
 */
function parseMarkdown(content: string): string {
  const parsed = marked.parse(content);
  return typeof parsed === "string" ? parsed : "";
}

// --- Generator Manifest Logic ---

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

/**
 * Sorts a list of generator variants by width and then by path.
 */
function sortGeneratorVariants(list: GeneratorVariant[]): GeneratorVariant[] {
  return [...list].sort((a, b) => {
    const left = a.width ?? 0;
    const right = b.width ?? 0;
    if (left === right) return (a.path || "").localeCompare(b.path || "");
    return left - right;
  });
}

export type ProcessedImageResult = {
  key: string;
  outputs: string[];
  image: ImageEntry;
};

/**
 * Builds a generator manifest mapping keys to available output variants and placeholder information.
 */
export function buildGeneratorManifest(
  results: ProcessedImageResult[],
): Record<string, GeneratorManifestEntry> {
  /**
   * Build a generator manifest mapping keys to available output variants and placeholder info.
   */
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
      outputs: [...res.outputs].sort((a, b) => a.localeCompare(b)),
    };
  }

  return manifest;
}

// --- Update Manifest Logic ---

/**
 * Creates a shallow clone of a PhotoDay object.
 */
function clonePhotoDay(day: PhotoDay): PhotoDay {
  return { ...day, items: [...(day.items || [])] };
}

/**
 * Removes items from a PhotoDay whose keys are in the deletedKeys list.
 */
function removeDeletedKeysFromDay(day: PhotoDay, deletedKeys: string[]): void {
  day.items = (day.items || []).filter((item) => {
    if (item.type === "separator") return true;
    return !deletedKeys.some((key) => item.src.startsWith(path.basename(key, path.extname(key))));
  });
}

/**
 * Removes images from a PhotoDay whose source path starts with the given base name.
 */
function removeImagesStartingWith(day: PhotoDay, baseNameWithoutExt: string): void {
  day.items = day.items.filter((item) => {
    if (item.type === "separator") return true;
    return !item.src.startsWith(baseNameWithoutExt);
  });
}

/**
 * Organizes items within a PhotoDay, sorting images and inserting separators based on location.
 */
function organizeDayItems(day: PhotoDay, storyData: StoryDataMap): PhotoDay {
  // 1. Extract and sort images
  const images = (day.items || []).filter((i): i is ImageEntry => i.type === "image");
  images.sort((a, b) => (a.exif?.date ?? "").localeCompare(b.exif?.date ?? ""));

  // 2. Group by location
  const imagesByLocation: Record<string, ImageEntry[]> = {};
  for (const image of images) {
    // Treat empty location as "Unknown" for grouping logic, but keep original data
    const location = image.exif?.location || "Unknown";
    if (!imagesByLocation[location]) imagesByLocation[location] = [];
    imagesByLocation[location].push(image);
  }

  // 3. Rebuild items list with separators
  const newItems: (ImageEntry | Separator)[] = [];
  const seenLocations = new Set<string>();
  const uniqueCities = new Set<string>();
  const uniqueLocations = new Set<string>();
  const citiesList: string[] = [];
  const locationsList: string[] = [];

  // Helper to collect metadata for the day summary
  const collectMetadata = (img: ImageEntry) => {
    const city = img.exif?.city;
    if (city && !uniqueCities.has(city)) {
      uniqueCities.add(city);
      citiesList.push(city);
    }
    const loc = img.exif?.location;
    if (loc && !uniqueLocations.has(loc)) {
      uniqueLocations.add(loc);
      locationsList.push(loc);
    }
  };

  for (const image of images) {
    collectMetadata(image);
    const location = image.exif?.location || "Unknown";
    const group = imagesByLocation[location] || [];

    // Insert separator if needed
    if (location !== "Unknown" && group.length > 2 && !seenLocations.has(location)) {
      const story = storyData[location];
      const storyContent = story?.content?.trim();

      const separator: Separator = {
        id: "loc-" + toSlug(location),
        type: "separator",
        location: location,
        city: group[0].exif?.city || "",
        ...(story && storyContent
          ? {
              storyTitle: story.title,
              story: parseMarkdown(storyContent),
            }
          : {}),
      };
      newItems.push(separator);
      seenLocations.add(location);
    }

    newItems.push(image);
  }

  const story = storyData[day.date]?.content;

  return {
    date: day.date,
    cities: citiesList,
    locations: locationsList,
    story,
    items: newItems,
    id: day.id || `day-${day.date}`,
  };
}

/**
 * Merges processed image results into the existing site manifest and removes deleted entries.
 */
export function updateManifest(
  results: ProcessedImageResult[],
  deletedKeys: string[],
  storyData: StoryDataMap,
  existingManifest: Manifest,
): Manifest {
  // 1. Clone
  const manifest: Manifest = {
    photoDays: existingManifest.photoDays.map(clonePhotoDay),
  };

  // 2. Remove Deleted
  manifest.photoDays.forEach((day) => removeDeletedKeysFromDay(day, deletedKeys));
  manifest.photoDays = manifest.photoDays.filter((d) => d.items.length > 0);

  // 3. Group New Results by Date
  const resultsByDate: Record<string, ProcessedImageResult[]> = {};
  for (const result of results) {
    if (!result) continue;
    const date = result.image.exif?.date?.substring(0, 10);
    if (!date) continue;
    if (!resultsByDate[date]) resultsByDate[date] = [];
    resultsByDate[date].push(result);
  }

  // 4. Merge Results into Days
  for (const [date, dayResults] of Object.entries(resultsByDate)) {
    let day = manifest.photoDays.find((d) => d.date === date);
    if (!day) {
      day = { date, items: [], id: "day-" + date };
      manifest.photoDays.push(day);
    }

    for (const result of dayResults) {
      // Remove previous version of this image if exists (to update it)
      const baseNameWithoutExt = path.basename(result.key, path.extname(result.key));
      removeImagesStartingWith(day, baseNameWithoutExt);
      day.items.push(result.image);
    }
  }

  // 5. Re-organize all days (sorting, separators, metadata aggregation)
  manifest.photoDays = manifest.photoDays.map((day) => organizeDayItems(day, storyData));

  // 6. Sort Days
  manifest.photoDays.sort((a, b) => a.date.localeCompare(b.date));

  return manifest;
}

// --- Menu Manifest Logic ---

export function generateMenuManifest(manifest: Manifest): MenuManifest {
  /**
   * Generate a menu manifest from the site manifest for navigation.
   */
  return manifest.photoDays.map(mapDayToMenu);
}

/**
 * Maps a location name to a menu item for the navigation menu.
 */
function mapLocationToMenuItem(
  locationName: string,
  day: PhotoDay,
): MenuManifest[number]["locations"][number] {
  const group = day.items.filter(
    (item): item is ImageEntry => item.type === "image" && item.exif?.location === locationName,
  );

  const locId = "loc-" + toSlug(locationName);
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

/**
 * Maps a PhotoDay object to a MenuManifest entry for the navigation menu.
 */
function mapDayToMenu(d: PhotoDay): MenuManifest[number] {
  const dayId = String(d.id || d.date).startsWith("day-")
    ? String(d.id || d.date)
    : "day-" + String(d.id || d.date);

  // Extract unique locations in order of appearance
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

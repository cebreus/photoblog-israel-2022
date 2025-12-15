import path from "node:path";
import { marked } from "marked";
import type {
  ImageEntry,
  Manifest,
  MenuManifest,
  PhotoDay,
  Separator,
  StoryDataMap,
} from "../../src/lib/types/manifest";
import { toSlug } from "../../src/lib/utils/strings"; // Corrected import

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

function sortGeneratorVariants(list: GeneratorVariant[]): GeneratorVariant[] {
  function compareVariantByWidth(
    a: GeneratorVariant,
    b: GeneratorVariant,
  ): number {
    const left = a.width ?? 0;
    const right = b.width ?? 0;
    if (left === right) return (a.path || "").localeCompare(b.path || "");
    return left - right;
  }
  return [...list].sort(compareVariantByWidth);
}

type ProcessedImageResult = {
  key: string;
  outputs: string[];
  image: ImageEntry;
};

/**
 * Build a compact generator-facing manifest describing available variants and outputs for each image.
 */
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

    function compareOutputStrings(a: string, b: string) {
      return a.localeCompare(b);
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
      placeholder: res.image.placeholder
        ? { width: null, height: null, type: null }
        : null,
      color: res.image.placeholderColor,
      outputs: [...res.outputs].sort(compareOutputStrings),
    };
  }

  return manifest;
}

/**
 * Update the site image manifest by applying processed results, removing deleted keys and inserting new images.
 */
export function updateManifest(
  results: ProcessedImageResult[],
  deletedKeys: string[],
  storyData: StoryDataMap,
  existingManifest: Manifest,
): Manifest {
  const manifest: Manifest = {
    photoDays: existingManifest.photoDays.map(clonePhotoDay),
  };

  function clonePhotoDay(day: PhotoDay): PhotoDay {
    return { ...day, items: [...(day.items || [])] };
  }

  manifest.photoDays.forEach(processDayRemovals);

  function processDayRemovals(day: PhotoDay): void {
    function keepItem(item: ImageEntry | Separator): boolean {
      if (item.type === "separator") return true;
      return !deletedKeys.some(function matchesKey(key: string) {
        return item.src.startsWith(path.basename(key, path.extname(key)));
      });
    }
    day.items = (day.items || []).filter(keepItem);
  }
  function hasItems(day: PhotoDay): boolean {
    return day.items.length > 0;
  }
  manifest.photoDays = manifest.photoDays.filter(hasItems);

  const resultsByDate: Record<string, ProcessedImageResult[]> = {};
  for (const result of results) {
    if (!result) continue;
    const date = result.image.exif?.date?.substring(0, 10);
    if (!date) continue;
    if (!resultsByDate[date]) resultsByDate[date] = [];
    resultsByDate[date].push(result);
  }

  for (const date of Object.keys(resultsByDate)) {
    const dayResults = resultsByDate[date];
    let day = manifest.photoDays.find(findByDate);
    function findByDate(d: PhotoDay) {
      return d.date === date;
    }

    if (!day) {
      day = { date, items: [], id: "day-" + date };
      manifest.photoDays.push(day);
    }

    for (const result of dayResults) {
      function keepForResult(item: ImageEntry | Separator): boolean {
        if (item.type === "separator") return true;
        return !item.src.startsWith(
          path.basename(result.key, path.extname(result.key)),
        );
      }
      day.items = day.items.filter(keepForResult);
      day.items.push(result.image);
    }

    function isImageEntry(item: ImageEntry | Separator): item is ImageEntry {
      return item.type === "image";
    }

    function compareByExifDate(a: ImageEntry, b: ImageEntry): number {
      return (a.exif?.date ?? "").localeCompare(b.exif?.date ?? "");
    }

    const imagesForDay = day.items.filter(isImageEntry).sort(compareByExifDate);

    const imagesByLocation: Record<string, ImageEntry[]> = {};
    for (const image of imagesForDay) {
      const location = image.exif?.location || "Unknown";
      if (!imagesByLocation[location]) imagesByLocation[location] = [];
      imagesByLocation[location].push(image);
    }

    const itemsWithSeparators: (ImageEntry | Separator)[] = [];
    const seenLocations = new Set<string>();

    for (const image of imagesForDay) {
      const location = image.exif?.location || "Unknown";
      const group = imagesByLocation[location] || [];

      if (
        location !== "Unknown" &&
        group.length > 2 &&
        !seenLocations.has(location)
      ) {
        const story = storyData[location];

        const storyContent = story?.content?.trim();
        const separator: Separator = {
          id: "loc-" + toSlug(location), // Using toSlug
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
        itemsWithSeparators.push(separator);
        seenLocations.add(location);
      }

      itemsWithSeparators.push(image);
    }
    day.items = itemsWithSeparators;
  }

  function compareDayDate(a: PhotoDay, b: PhotoDay): number {
    return a.date.localeCompare(b.date);
  }

  // Recalculate cities and locations for ALL days to ensure consistency
  // regardless of whether they were updated in this run.
  // Recalculate cities, locations, and story for ALL days, and enforce field order.
  manifest.photoDays = manifest.photoDays.map((day) => {
    const uniqueCities = new Set<string>();
    const uniqueLocations = new Set<string>();
    const cities: string[] = [];
    const locations: string[] = [];

    // Filter only images to avoid duplicates from separators
    const images = (day.items || []).filter(
      (i) => i.type === "image",
    ) as ImageEntry[];

    for (const image of images) {
      const city = image.exif?.city;
      if (city && !uniqueCities.has(city)) {
        uniqueCities.add(city);
        cities.push(city);
      }
      const loc = image.exif?.location;
      if (loc && !uniqueLocations.has(loc)) {
        uniqueLocations.add(loc);
        locations.push(loc);
      }
    }

    const story = storyData[day.date]?.content;

    // Return new object with enforced key order
    return {
      date: day.date,
      cities,
      locations,
      story,
      items: day.items,
      id: day.id || `day-${day.date}`,
    };
  });

  manifest.photoDays.sort(compareDayDate);
  return manifest;
}

function mapDayToMenu(d: PhotoDay): MenuManifest[number] {
  const dayId = String(d.id || d.date).startsWith("day-")
    ? String(d.id || d.date)
    : "day-" + String(d.id || d.date);

  const locationsInOrder: string[] = [];
  const seenLocations = new Set<string>();

  for (const item of d.items) {
    let location: string | undefined;
    if (item.type === "image") {
      location = item.exif?.location;
    } else {
      location = item.location;
    }
    if (location && location !== "Unknown" && !seenLocations.has(location)) {
      locationsInOrder.push(location);
      seenLocations.add(location);
    }
  }

  function mapLocationForThisDay(loc: string) {
    return mapLocationToMenuItem(loc, d);
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
    locations: locationsInOrder.map(mapLocationForThisDay),
  };
}

function mapLocationToMenuItem(
  locationName: string,
  day: PhotoDay,
): MenuManifest[number]["locations"][number] {
  function isImageInLocation(item: ImageEntry | Separator): item is ImageEntry {
    return item.type === "image" && item.exif?.location === locationName;
  }
  const group = day.items.filter(isImageInLocation);
  const locId = "loc-" + toSlug(locationName); // Using toSlug
  const isDimmed = group.length <= 2;

  let href = `#${locId}`;
  if (isDimmed && group.length > 0) {
    href = `#${group[0].id}`;
  }

  return {
    id: locId,
    label: locationName,
    href: href,
    isDimmed: isDimmed,
    firstPhotoExifDate: group[0]?.exif?.date,
  };
}

/**
 * Convert the full images manifest into a lightweight menu manifest used by the site navigation.
 */
export function generateMenuManifest(manifest: Manifest): MenuManifest {
  return manifest.photoDays.map(mapDayToMenu);
}

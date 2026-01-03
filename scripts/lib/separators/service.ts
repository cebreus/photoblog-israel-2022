import { marked } from "marked";
import { config } from "$scripts/build.config";
import type { ImageEntry, Separator, StoryData, StoryDataMap } from "$shared/types/manifest";
import { toSlug } from "$shared/utils/strings";

/**
 * Service for managing photo grid separators.
 * Centralizes all separator-related logic including creation,
 * photo assignment, and menu item generation.
 */

/**
 * Parse markdown content to HTML.
 */
function parseMarkdown(content: string): string {
  const parsed = marked.parse(content);
  return typeof parsed === "string" ? parsed : "";
}

/**
 * Creates a separator from a visit (markdown-defined or auto-generated).
 */
export function createSeparator(
  location: string,
  story: StoryData | undefined,
  startDate?: string,
  endDate?: string,
  city: string = "",
): Separator {
  const storyContent = story?.content || "";

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
    city: city || story?.city || "",
    hasPhotos: false, // Will be determined by assignPhotos()
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

/**
 * Extracts separators from markdown for a specific day.
 */
export function getMarkdownSeparatorsForDay(dayDate: string, storyData: StoryDataMap): Separator[] {
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
        separators.push(createSeparator(locationKey, story, start, end));
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

/**
 * Creates an auto-separator from photos at a location.
 * Returns null if the location doesn't meet the minimum photo threshold.
 */
export function createAutoSeparator(location: string, photos: ImageEntry[]): Separator | null {
  if (
    photos.length < config.separator.minPhotosForAutoSeparator ||
    !location ||
    location === "Unknown"
  ) {
    return null;
  }

  // Use first photo's timestamp as separator timestamp
  const firstPhoto = photos[0];
  const timestamp = firstPhoto.exif?.releaseDate ?? firstPhoto.exif?.date;
  const city = firstPhoto.exif?.city || "";

  return createSeparator(location, undefined, timestamp, undefined, city);
}

/**
 * Assigns photos to a separator based on time range and location.
 * NEW LOGIC: Uses explicit time-based matching instead of "look-ahead".
 *
 * A photo belongs to a separator if:
 * 1. It has the same location
 * 2. Its timestamp falls within the separator's time range (or matches if no range)
 */
export function assignPhotos(separator: Separator, allPhotos: ImageEntry[]): Separator {
  let photoCount = 0;
  let inferredCity = "";

  for (const photo of allPhotos) {
    const photoLocation = photo.exif?.location || "Unknown";
    const photoTimestamp = photo.exif?.releaseDate ?? photo.exif?.date;

    // Location must match
    if (photoLocation !== separator.location) continue;

    let matches = false;
    // If separator has time range, photo must be within it
    if (separator.startDate || separator.endDate) {
      if (photoTimestamp) {
        const start = separator.startDate || "1970-01-01T00:00:00";
        const end = separator.endDate || "9999-12-31T23:59:59";
        if (photoTimestamp >= start && photoTimestamp <= end) {
          matches = true;
        }
      }
    } else {
      // No time range - just count all photos with this location
      matches = true;
    }

    if (matches) {
      photoCount++;
      if (!inferredCity && photo.exif?.city) {
        inferredCity = photo.exif?.city;
      }
    }
  }

  return {
    ...separator,
    city: separator.city || inferredCity,
    hasPhotos: photoCount >= config.separator.minPhotosForDisplay,
  };
}

/**
 * Groups images by location for easier processing.
 */
export function groupImagesByLocation(images: ImageEntry[]): Record<string, ImageEntry[]> {
  const grouped: Record<string, ImageEntry[]> = {};

  for (const img of images) {
    const loc = img.exif?.location || "Unknown";
    if (!grouped[loc]) grouped[loc] = [];
    grouped[loc].push(img);
  }

  return grouped;
}

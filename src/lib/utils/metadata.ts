import type { ImageEntry } from "$shared/types/manifest";
import { formatWallClock } from "$shared/utils/dates";

// formatDateTimeForClipboard removed in favor of shared formatWallClock

/**
 * Extracts filename from image source path.
 */
function getFilename(src: string): string | undefined {
  return src.split("/").pop();
}

/**
 * Builds location string from image location data.
 * Filters out "Unknown" locations and combines available fields.
 */
function buildLocationString(item: ImageEntry): string | null {
  const parts = [
    item.location !== "Unknown" ? item.location : null,
    item.city,
    item.exif?.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Formats image metadata for clipboard copy, focusing on objective facts:
 * File, Date, Location, GPS coordinates.
 *
 * Excludes subjective fields like captions and keywords that may confuse LLMs.
 */
export function formatMetadataForClipboard(item: ImageEntry): string {
  const lines: string[] = [];

  const filename = getFilename(item.src);
  if (filename) {
    lines.push(`File: ${filename}`);
  }

  if (item.date) {
    lines.push(`Date: ${formatWallClock(item.date)}`);
  }

  const location = buildLocationString(item);
  if (location) {
    lines.push(`Location: ${location}`);
  }

  const lat = item.latitude ?? item.exif?.latitude;
  const lon = item.longitude ?? item.exif?.longitude;

  if (lat != null && lon != null) {
    lines.push(`GPS: ${lat}, ${lon}`);
  }

  return lines.join("\n");
}

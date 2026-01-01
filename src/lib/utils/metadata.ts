import type { ImageEntry } from "$shared/types/manifest";

/**
 * Formats a Date object to ISO-like timestamp format (YYYY-MM-DD HH:mm).
 * Used for unambiguous date representation in copied metadata.
 */
function formatDateTimeForClipboard(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

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
    const dateStr = formatDateTimeForClipboard(new Date(item.date));
    lines.push(`Date: ${dateStr}`);
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

/**
 * Build-time utilities for detecting and working with image sequences.
 * Re-exports shared utilities and adds build-specific functions.
 */

// Re-export shared utilities using the $shared alias
export {
  getSequenceMembers,
  isPanorama,
  isRepresentative,
  isSequenceMember,
  parseSequenceSuffix,
  SEQUENCE_REGEX,
  TYPE_MAP,
} from "$shared/utils/sequences";

import type { ImageEntry, SequenceInfo } from "$shared/types/manifest";
import { parseSequenceSuffix } from "$shared/utils/sequences";

/**
 * Classify media type based on filename.
 * - Returns "sequence" for the representative (last) item in a sequence.
 * - Returns "sequence-member" for other items in a sequence.
 * - Returns "panorama" for single-file panoramas.
 * - Returns "image" otherwise.
 */
export function classifyMediaType(
  filename: string,
): "image" | "sequence" | "sequence-member" | "panorama" {
  const info = parseSequenceSuffix(filename);
  if (!info) return "image";
  if (info.type === "pano") return "panorama";
  return info.index === info.total ? "sequence" : "sequence-member";
}

/** Time window for grouping sequences (10 minutes in milliseconds) */
const SEQUENCE_TIME_WINDOW_MS = 10 * 60 * 1000;

/**
 * Extract timestamp from image ID (format: YYYY-MM-DD-HHMMSS-author--suffix)
 */
function extractTimestamp(imageId: string): Date | null {
  // Match: 2025-11-25-083807 (YYYY-MM-DD-HHMMSS)
  const match = imageId.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, min, sec] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(min),
    Number(sec),
  );
}

/**
 * Extract author from image ID (format: YYYY-MM-DD-HHMMSS-author--suffix)
 */
function extractAuthor(imageId: string): string {
  const match = imageId.match(/^\d{4}-\d{2}-\d{2}-\d{6}-([^-]+)/);
  return match?.[1] ?? "";
}

/**
 * Groups photos by sequence type + author + time proximity and returns complete SequenceInfo for each.
 * Sequences are grouped within a 10-minute time window.
 */
export function detectSequences(
  images: ImageEntry[],
): Map<string, SequenceInfo & { members?: string[] }> {
  const sequences = new Map<string, SequenceInfo & { members?: string[] }>();

  // Collect all sequence images with their parsed info and timestamp
  const sequenceImages: Array<{
    id: string;
    info: SequenceInfo;
    timestamp: Date;
    author: string;
  }> = [];

  for (const image of images) {
    const info = parseSequenceSuffix(image.id);
    if (info) {
      const timestamp = extractTimestamp(image.id);
      if (timestamp) {
        sequenceImages.push({
          id: image.id,
          info,
          timestamp,
          author: extractAuthor(image.id),
        });
      }
    }
  }

  // Sort by type, author, then timestamp
  sequenceImages.sort((a, b) => {
    if (a.info.type !== b.info.type) return a.info.type.localeCompare(b.info.type);
    if (a.author !== b.author) return a.author.localeCompare(b.author);
    return a.timestamp.getTime() - b.timestamp.getTime();
  });

  // Group by type + author + time proximity
  const groups: Array<typeof sequenceImages> = [];
  let currentGroup: typeof sequenceImages = [];

  for (const img of sequenceImages) {
    if (currentGroup.length === 0) {
      currentGroup.push(img);
      continue;
    }

    const lastInGroup = currentGroup[currentGroup.length - 1];
    const sameType = img.info.type === lastInGroup.info.type;
    const sameAuthor = img.author === lastInGroup.author;
    const withinWindow =
      Math.abs(img.timestamp.getTime() - lastInGroup.timestamp.getTime()) < SEQUENCE_TIME_WINDOW_MS;

    if (sameType && sameAuthor && withinWindow) {
      currentGroup.push(img);
    } else {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [img];
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Build SequenceInfo for each image in each group
  for (const group of groups) {
    const memberIds = group.map((g) => g.id).sort();
    // Use the first member's ID (earliest timestamp) as the common baseId
    const commonBaseId = group[0].id.replace(/--[a-z]+\d+from\d+$|--pano$/, "");

    for (const img of group) {
      sequences.set(img.id, {
        ...img.info,
        baseId: commonBaseId, // Override with common baseId
        members: memberIds,
      });
    }
  }

  return sequences;
}

/**
 * Filter predicate for grid visibility.
 */
function isVisibleInGrid(image: ImageEntry): boolean {
  if (image.type === "image" || image.type === "panorama") return true;
  if (image.type === "sequence") return true;
  if (image.type === "sequence-member") return false;
  return true;
}

/**
 * Returns only "representative" photos for grid (last in sequence)
 * AND all non-sequence photos.
 * Sequence members that are NOT representative are excluded.
 */
export function filterRepresentativeImages(images: ImageEntry[]): ImageEntry[] {
  return images.filter(isVisibleInGrid);
}

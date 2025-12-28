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

/**
 * Groups photos by baseId and returns complete SequenceInfo for each.
 */
export function detectSequences(
  images: ImageEntry[],
): Map<string, SequenceInfo & { members?: string[] }> {
  const sequences = new Map<string, SequenceInfo & { members?: string[] }>();
  const membersByBaseId = new Map<string, string[]>();

  // First pass: collect members
  for (const image of images) {
    const info = parseSequenceSuffix(image.id);
    if (info) {
      if (!membersByBaseId.has(info.baseId)) {
        membersByBaseId.set(info.baseId, []);
      }
      membersByBaseId.get(info.baseId)?.push(image.id);
    }
  }

  // Second pass: build SequenceInfo
  for (const [_baseId, members] of membersByBaseId) {
    for (const imageId of members) {
      const info = parseSequenceSuffix(imageId);
      if (info) {
        sequences.set(imageId, {
          ...info,
          members: [...members].sort(),
        });
      }
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

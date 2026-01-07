import {
  isImageEntry,
  type MediaItemType,
  type PhotoDay,
  type PhotoDayItem,
  type QualityBucket,
  type QualityFilterBucket,
} from "$lib/types/manifest";
import { isRepresentative, isSequenceMember } from "$lib/utils/sequences";

export const QUALITY_BUCKETS: { id: QualityFilterBucket; label: string }[] = [
  { id: "excellent", label: "Excelentní" },
  { id: "good", label: "Dobré" },
  { id: "poor", label: "Podprůměrné" },
  { id: "unrated", label: "Bez hodnocení" },
];

/** Check if item has a specific flag */
function hasFlag(item: PhotoDayItem, flag: string): boolean {
  if (!isImageEntry(item)) return false;
  return Array.isArray(item.flags) && item.flags.includes(flag);
}

/** Check if item is a snapshot (author or others) */
function _isSnapshot(item: PhotoDayItem): boolean {
  return hasFlag(item, "snapshot-author") || hasFlag(item, "snapshot-others");
}

/** Check if item is a snapshot by others */
function isOthersSnapshot(item: PhotoDayItem): boolean {
  return hasFlag(item, "snapshot-others");
}

/** Check if item is a snapshot by author */
function isAuthorSnapshot(item: PhotoDayItem): boolean {
  const isSnap = hasFlag(item, "snapshot-author");
  if (isSnap) {
    // console.log(`[DEBUG] Item ${item.id} is author snapshot. Flags:`, item.flags);
  }
  return isSnap;
}

export type FilterCriteria = {
  selectedAuthors: string[];
  showSeparators: boolean;
  selectedQualityBuckets: QualityFilterBucket[];
  selectedPeople: string[];
  selectedMediaTypes: MediaItemType[];
  showOthersSnapshots: boolean;
  showAuthorSnapshots: boolean;
  onlySnapshots: boolean;
};

/**
 * Builds a map of image IDs to people IDs from the photo days data.
 * This replaces the dependency on images.ts
 */
export function buildImagePeopleMap(photoDays: PhotoDay[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.people && item.people.length > 0) {
        map[item.id] = item.people;
      }
    }
  }
  return map;
}

function shouldIncludeItem(
  item: PhotoDayItem,
  criteria: FilterCriteria,
  isDefaultQualityView: boolean,
  imagePeopleMap: Record<string, string[]>,
): boolean {
  if (!isImageEntry(item)) {
    return true; // Always include separators as they might be needed for menu anchors
  }

  // Filter ONLY snapshots mode
  if (criteria.onlySnapshots && !isAuthorSnapshot(item) && !isOthersSnapshot(item)) {
    return false;
  }

  // Hide source images that were used for collages
  if (item.category === "collage-source") {
    return false;
  }

  // Hide non-representative members of sequences (show only the last frame in grid)
  if (isSequenceMember(item.id) && !isRepresentative(item.id)) {
    return false;
  }

  // Determine effective type for filtering
  let effectiveType = item.type;

  // Panoramas can be identified by aspectRatio even if type is "image"
  if (effectiveType === "image" && item.aspectRatio === "panorama") {
    effectiveType = "panorama";
  }

  // Collages can be identified by aspectRatio or ID pattern even if type is "image"
  if (
    effectiveType === "image" &&
    (item.aspectRatio === "collage" || item.id.includes("--collage"))
  ) {
    effectiveType = "collage";
  }

  if (criteria.selectedMediaTypes.length > 0) {
    if ((criteria.selectedMediaTypes as string[]).includes("none")) {
      return false;
    }

    if (!criteria.selectedMediaTypes.includes(effectiveType)) {
      return false;
    }
  }

  // Hide others' snapshots unless explicitly enabled
  if (!criteria.showOthersSnapshots && isOthersSnapshot(item)) {
    return false;
  }

  // Hide author's snapshots unless explicitly enabled
  if (!criteria.showAuthorSnapshots && isAuthorSnapshot(item)) {
    return false;
  }

  if (criteria.selectedAuthors.length > 0) {
    if (criteria.selectedAuthors.includes("none")) {
      return false;
    }
    const authorMatches = criteria.selectedAuthors.includes(item.authorSlug || "neuvedeno");
    if (!authorMatches) {
      return false;
    }
  }

  if (!isDefaultQualityView) {
    if ((criteria.selectedQualityBuckets as string[]).includes("none")) {
      return false;
    }

    const bucket = item.analysis?.qualityBucket;
    const selectedBuckets = criteria.selectedQualityBuckets as Array<QualityBucket | "unrated">;
    const wantsUnrated = selectedBuckets.includes("unrated");
    const wantsRatedBuckets = selectedBuckets.filter((b) => b !== "unrated") as QualityBucket[];

    // If image has no bucket
    if (!bucket) {
      // Only show if "unrated" is selected
      return wantsUnrated;
    }

    // If image has bucket, only show if that bucket is selected
    return wantsRatedBuckets.includes(bucket);
  }

  if (criteria.selectedPeople.length > 0) {
    if (criteria.selectedPeople.includes("none")) {
      return false;
    }
    const itemPeople = item.people || imagePeopleMap[item.id] || [];
    const hasUnknown = criteria.selectedPeople.includes("unknown");

    if (itemPeople.length === 0) {
      if (!hasUnknown) {
        return false;
      }
    } else {
      const personMatches = itemPeople.some(function checkPerson(p: string) {
        return criteria.selectedPeople.includes(p);
      });
      if (!personMatches) {
        return false;
      }
    }
  }

  return true;
}

export function filterGalleryItems(
  items: PhotoDayItem[],
  criteria: FilterCriteria,
  imagePeopleMap: Record<string, string[]>,
): PhotoDayItem[] {
  const isDefaultQualityView = criteria.selectedQualityBuckets.length === 0;

  return items.filter(function filterItem(item) {
    if (!isImageEntry(item)) {
      return true; // Always include separators as they might be needed for menu anchors
    }
    return shouldIncludeItem(item, criteria, isDefaultQualityView, imagePeopleMap);
  });
}

export function computeTotals(
  criteria: FilterCriteria,
  photoDaysData: PhotoDay[],
): { visiblePhotos: number; totalLocations: number } {
  let visiblePhotos = 0;
  const uniqueLocations = new Set<string>();

  const imagePeopleMap = buildImagePeopleMap(photoDaysData);
  const allPhotoDays = photoDaysData;

  for (const day of allPhotoDays) {
    const filteredItems = filterGalleryItems(day.items, criteria, imagePeopleMap);

    for (const item of filteredItems) {
      if (item.type !== "separator") {
        visiblePhotos++;
        if (item.location) {
          uniqueLocations.add(item.location);
        }
      } else if (item.type === "separator" && criteria.showSeparators) {
        if (item.location) {
          uniqueLocations.add(item.location);
        }
      }
    }
  }

  return {
    visiblePhotos,
    totalLocations: uniqueLocations.size,
  };
}

function extractItems(day: PhotoDay): PhotoDayItem[] {
  return day.items;
}

function extractDate(day: PhotoDay): string {
  return day.date;
}

function extractUniqueCities(days: PhotoDay[]): string[] {
  return Array.from(new Set(days.flatMap((d) => d.cities ?? []))).filter(Boolean);
}

function extractUniqueLocations(days: PhotoDay[]): string[] {
  return Array.from(new Set(days.flatMap((d) => d.locations ?? []))).filter(Boolean);
}

function createMergedId(days: PhotoDay[]): string {
  return days.map((d) => d.id ?? `day-${d.date}`).join("--");
}

function createMergedDay(days: PhotoDay[]): PhotoDay {
  const first = days[0];
  const items = days.flatMap(extractItems);
  const cities = extractUniqueCities(days);
  const locations = extractUniqueLocations(days);

  return {
    ...first,
    id: createMergedId(days),
    items,
    cities,
    locations,
    mergedDates: days.map(extractDate),
  };
}

function isImageItem(item: PhotoDayItem): boolean {
  return (
    item.type === "image" ||
    item.type === "collage" ||
    item.type === "panorama" ||
    item.type === "sequence" ||
    item.type === "sequence-member"
  );
}

function countImageItems(day: PhotoDay): number {
  return day.items.filter(isImageItem).length;
}

export function mergeSparseDays(days: PhotoDay[]): PhotoDay[] {
  const result: PhotoDay[] = [];
  let pendingMerge: PhotoDay[] = [];

  function flushPendingMerge(): void {
    if (pendingMerge.length === 0) return;

    if (pendingMerge.length === 1) {
      result.push(pendingMerge[0]);
    } else {
      result.push(createMergedDay(pendingMerge));
    }

    pendingMerge = [];
  }

  for (const day of days) {
    const imageCount = countImageItems(day);

    if (imageCount <= 2) {
      pendingMerge.push(day);
    } else {
      flushPendingMerge();
      result.push(day);
    }
  }

  flushPendingMerge();

  return result;
}

import {
  isImageEntry,
  type MediaItemType,
  type PhotoDay,
  type PhotoDayItem,
  type QualityFilterBucket,
} from "$lib/types/manifest";
import { isRepresentative, isSequenceMember } from "$lib/utils/sequences";

export const QUALITY_BUCKETS: { id: QualityFilterBucket; label: string }[] = [
  { id: "excellent", label: "Excelentní" },
  { id: "good", label: "Dobré" },
  { id: "poor", label: "Podprůměrné" },
  { id: "unrated", label: "Bez hodnocení" },
];

/**
 * Basic visibility check for gallery items.
 * Hides collage sources and non-representative sequence members.
 */
export function isGloballyVisible(item: PhotoDayItem): boolean {
  if (!isImageEntry(item)) return false;

  // Hide source images that were used for collages
  if (item.category === "collage-source") return false;

  // Hide non-representative members of sequences
  if (isSequenceMember(item.id) && !isRepresentative(item.id)) return false;

  return true;
}

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
  selectedAuthors: Set<string>;
  showSeparators: boolean;
  selectedQualityBuckets: Set<QualityFilterBucket | "unrated">;
  selectedPeople: Set<string>;
  selectedMediaTypes: Set<MediaItemType | "none">;
  showOthersSnapshots: boolean;
  showAuthorSnapshots: boolean;
  onlySnapshots: boolean;
};

function shouldIncludeItem(
  item: PhotoDayItem,
  criteria: FilterCriteria,
  isDefaultQualityView: boolean,
): boolean {
  if (!isImageEntry(item)) {
    return true; // Always include separators as they might be needed for menu anchors
  }

  // 1. Technical Exclusions (Always Hide)
  if (item.category === "collage-source") return false;
  if (isSequenceMember(item.id) && !isRepresentative(item.id)) return false;

  const isSnapAuthor = isAuthorSnapshot(item);
  const isSnapOthers = isOthersSnapshot(item);
  const isSnap = isSnapAuthor || isSnapOthers;

  // 2. Filter ONLY snapshots mode
  if (criteria.onlySnapshots && !isSnap) return false;

  // 3. Determine if any specific inclusion filter is active
  const isFilteringAuthors = criteria.selectedAuthors.size > 0;
  const isFilteringPeople = criteria.selectedPeople.size > 0;
  const isFilteringMedia = criteria.selectedMediaTypes.size > 0;
  const isFilteringQuality = !isDefaultQualityView;

  // Any active selection filter constitutes a "search" intent
  const isActivelySearching =
    isFilteringAuthors || isFilteringPeople || isFilteringMedia || isFilteringQuality;

  // 4. Attribution Filters (Must produce a match if active)

  // Media Types
  if (isFilteringMedia) {
    if (criteria.selectedMediaTypes.has("none")) return false;

    let effectiveType = item.type;
    if (effectiveType === "image" && item.aspectRatio === "panorama") effectiveType = "panorama";
    if (
      effectiveType === "image" &&
      (item.aspectRatio === "collage" || item.id.includes("--collage"))
    ) {
      effectiveType = "collage";
    }

    if (!criteria.selectedMediaTypes.has(effectiveType)) return false;
  }

  // Authors
  if (isFilteringAuthors) {
    if (criteria.selectedAuthors.has("none")) return false;
    const authorMatches = criteria.selectedAuthors.has(item.authorSlug || "neuvedeno");
    if (!authorMatches) return false;
  }

  // Quality
  if (isFilteringQuality) {
    if ((criteria.selectedQualityBuckets as Set<string>).has("none")) return false;
    const bucket = item.analysis?.qualityBucket;
    const wantsUnrated = criteria.selectedQualityBuckets.has("unrated");
    if (!bucket && !wantsUnrated) return false;
    if (bucket && !criteria.selectedQualityBuckets.has(bucket)) return false;
  }

  // People
  if (isFilteringPeople) {
    if (criteria.selectedPeople.has("none")) return false;
    const itemPeople = item.people || [];
    const hasUnknown = criteria.selectedPeople.has("unknown");
    const wantsWithoutPeople = criteria.selectedPeople.has("__without_people__");
    const wantsWithPeople = criteria.selectedPeople.has("__with_people__");

    if (itemPeople.length === 0) {
      if (!hasUnknown && !wantsWithoutPeople) return false;
    } else {
      if (!wantsWithPeople) {
        const personMatches = itemPeople.some((p) => criteria.selectedPeople.has(p));
        if (!personMatches) return false;
      }
    }
  }

  // 5. Snapshot Visibility Policy
  // If we are actively searching for something specific, we show matching snapshots
  // regardless of the global "hide snapshots" settings.
  if (isSnap && !isActivelySearching) {
    if (isSnapAuthor && !criteria.showAuthorSnapshots) return false;
    if (isSnapOthers && !criteria.showOthersSnapshots) return false;
  }

  return true;
}

export function filterGalleryItems(
  items: PhotoDayItem[],
  criteria: FilterCriteria,
): PhotoDayItem[] {
  // Pre-calculate quality check to avoid repeated set lookups for "unrated"
  // But Set.has is O(1) so it's fine. Main logic is inside shouldIncludeItem.
  const isDefaultQualityView = criteria.selectedQualityBuckets.size === 0;

  function shouldInclude(item: PhotoDayItem): boolean {
    if (!isImageEntry(item)) {
      return criteria.showSeparators;
    }
    return shouldIncludeItem(item, criteria, isDefaultQualityView);
  }

  return items.filter(shouldInclude);
}

// Re-export this for stats calculation if needed, though stats generally needs custom accumulation
// computeTotals iterates similarly but accumulates counts.
export function computeTotals(
  criteria: Omit<
    FilterCriteria,
    "selectedAuthors" | "selectedPeople" | "selectedMediaTypes" | "selectedQualityBuckets"
  > & {
    selectedAuthors: string[];
    selectedPeople: string[];
    selectedMediaTypes: MediaItemType[];
    selectedQualityBuckets: QualityFilterBucket[];
  },
  photoDays: PhotoDay[],
) {
  // Convert arrays to Sets for O(1) lookups during traversal
  const criteriaSets: FilterCriteria = {
    ...criteria,
    selectedAuthors: new Set(criteria.selectedAuthors),
    selectedPeople: new Set(criteria.selectedPeople),
    selectedMediaTypes: new Set(criteria.selectedMediaTypes),
    selectedQualityBuckets: new Set(criteria.selectedQualityBuckets),
  };

  const isDefaultQualityView = criteriaSets.selectedQualityBuckets.size === 0;

  let visiblePhotos = 0;
  const uniqueLocations = new Set<string>();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item)) {
        if (criteriaSets.showSeparators && item.location) {
          uniqueLocations.add(item.location);
        }
        continue;
      }

      if (shouldIncludeItem(item, criteriaSets, isDefaultQualityView)) {
        visiblePhotos++;
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

function countImageItems(day: PhotoDay): number {
  return day.items.filter(isImageEntry).length;
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

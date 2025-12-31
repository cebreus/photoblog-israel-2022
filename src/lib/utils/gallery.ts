import {
  isImageEntry,
  type MediaItemType,
  type PhotoDay,
  type PhotoDayItem,
  type QualityBucket,
} from "$lib/types/manifest";
import { getImagePeopleMap, getPhotoDays } from "$lib/utils/images";
import { isRepresentative, isSequenceMember } from "$lib/utils/sequences";

export const QUALITY_BUCKETS: { id: QualityBucket; label: string }[] = [
  { id: "excellent", label: "Excelentní" },
  { id: "good", label: "Dobré" },
  { id: "poor", label: "Podprůměrné" },
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
  selectedQualityBuckets: QualityBucket[];
  selectedPeople: string[];
  selectedMediaTypes: MediaItemType[];
  showOthersSnapshots: boolean;
  showAuthorSnapshots: boolean;
  onlySnapshots: boolean;
};

function shouldIncludeItem(
  item: PhotoDayItem,
  criteria: FilterCriteria,
  isDefaultQualityView: boolean,
  imagePeopleMap: Record<string, string[]>,
): boolean {
  if (!isImageEntry(item)) {
    return criteria.showSeparators;
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

  if (criteria.selectedMediaTypes.length > 0) {
    if ((criteria.selectedMediaTypes as string[]).includes("none")) {
      return false;
    }
    if (!criteria.selectedMediaTypes.includes(item.type)) {
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
    if (!authorMatches) return false;
  }

  if (!isDefaultQualityView) {
    if ((criteria.selectedQualityBuckets as string[]).includes("none")) {
      return false;
    }
    const bucket = item.analysis?.qualityBucket;
    if (!bucket || !criteria.selectedQualityBuckets.includes(bucket)) {
      return false;
    }
  }

  if (criteria.selectedPeople.length > 0) {
    if (criteria.selectedPeople.includes("none")) {
      return false;
    }
    const itemPeople = item.people || imagePeopleMap[item.id] || [];
    const hasUnknown = criteria.selectedPeople.includes("unknown");

    if (itemPeople.length === 0) {
      if (!hasUnknown) return false;
    } else {
      const personMatches = itemPeople.some(function checkPerson(p: string) {
        return criteria.selectedPeople.includes(p);
      });
      if (!personMatches) return false;
    }
  }

  return true;
}

export function filterGalleryItems(
  items: PhotoDayItem[],
  criteria: FilterCriteria,
): PhotoDayItem[] {
  const isDefaultQualityView = criteria.selectedQualityBuckets.length === 0;
  const imagePeopleMap = getImagePeopleMap();

  return items.filter(function filterItem(item) {
    return shouldIncludeItem(item, criteria, isDefaultQualityView, imagePeopleMap);
  });
}

export function computeTotals(
  criteria: FilterCriteria,
  photoDaysData: PhotoDay[] = getPhotoDays(),
): { visiblePhotos: number; totalLocations: number } {
  let visiblePhotos = 0;
  const uniqueLocations = new Set<string>();

  const allPhotoDays = photoDaysData;

  for (const day of allPhotoDays) {
    const filteredItems = filterGalleryItems(day.items, criteria);

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
  return item.type === "image";
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

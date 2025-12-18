import type { ImageEntry, PhotoDay, PhotoDayItem, QualityBucket } from "$lib/types/manifest";
import { getImagePeopleMap, getPhotoDays } from "$lib/utils/images";

export const QUALITY_BUCKETS: { id: QualityBucket; label: string }[] = [
  { id: "excellent", label: "Excelentní" },
  { id: "good", label: "Dobré" },
  { id: "poor", label: "Podprůměrné" },
];

const ALL_QUALITY_BUCKET_IDS = QUALITY_BUCKETS.map((b) => b.id);

function shouldIncludeItem(
  item: PhotoDayItem,
  showSeparators: boolean,
  selectedAuthors: string[],
  selectedQualityBuckets: QualityBucket[],
  selectedPeople: string[],
  isDefaultView: boolean,
  imagePeopleMap: Record<string, string[]>,
): boolean {
  if (item.type === "separator") {
    return showSeparators;
  }

  const img = item as ImageEntry;

  if (selectedAuthors.length > 0) {
    if (selectedAuthors.includes("none")) {
      return false; 
    }
    const authorMatches = selectedAuthors.includes(img.authorSlug || "");
    if (!authorMatches) return false;
  }

  if (!isDefaultView) {
    const bucket = img.analysis?.qualityBucket;
    if (!bucket || !selectedQualityBuckets.includes(bucket)) {
      return false;
    }
  }

  if (selectedPeople.length > 0) {
    const people = img.people || imagePeopleMap[img.id] || [];
    const hasNone = selectedPeople.includes("none");

    if (people.length === 0) {
      return hasNone;
    }

    if (hasNone && selectedPeople.length === 1) {
      return false;
    }

    const personMatches = people.some((p) => selectedPeople.includes(p));
    if (!personMatches) return false;
  }

  return true;
}

export function filterGalleryItems(
  items: PhotoDayItem[],
  selectedAuthors: string[],
  showSeparators: boolean,
  selectedQualityBuckets: QualityBucket[] = [],
  selectedPeople: string[] = [],
): PhotoDayItem[] {
  const isDefaultView = ALL_QUALITY_BUCKET_IDS.every((b) => selectedQualityBuckets.includes(b));

  const imagePeopleMap = getImagePeopleMap();

  return items.filter((item) =>
    shouldIncludeItem(
      item,
      showSeparators,
      selectedAuthors,
      selectedQualityBuckets,
      selectedPeople,
      isDefaultView,
      imagePeopleMap,
    ),
  );
}

export function computeTotals(
  selectedAuthors: string[],
  showSeparators: boolean,
  selectedQualityBuckets: QualityBucket[],
  selectedAestheticBuckets: string[],
  photoDaysData: PhotoDay[] = getPhotoDays(),
): { visiblePhotos: number; totalLocations: number } {
  let visiblePhotos = 0;
  const uniqueLocations = new Set<string>();

  const allPhotoDays = photoDaysData;

  for (const day of allPhotoDays) {
    const filteredItems = filterGalleryItems(
      day.items,
      selectedAuthors,
      showSeparators,
      selectedQualityBuckets,
      selectedAestheticBuckets,
    );

    for (const item of filteredItems) {
      if (item.type === "image") {
        visiblePhotos++;
        if (item.location) {
          uniqueLocations.add(item.location);
        }
      } else if (item.type === "separator" && showSeparators) {
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

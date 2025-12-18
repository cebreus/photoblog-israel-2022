import type { ImageEntry, PhotoDay, PhotoDayItem, QualityBucket } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";

// Helper removed: getAestheticBucket is now handled at build time in scripts/lib/manifest-builder.ts

export const QUALITY_BUCKETS: { id: QualityBucket; label: string }[] = [
  { id: "excellent", label: "Excelentní" },
  { id: "good", label: "Dobré" },
  { id: "poor", label: "Podprůměrné" },
];

const ALL_QUALITY_BUCKET_IDS = QUALITY_BUCKETS.map((b) => b.id);

export function filterGalleryItems(
  items: PhotoDayItem[],
  selectedAuthors: string[],
  showSeparators: boolean,
  selectedQualityBuckets: QualityBucket[] = [],
  selectedAestheticBuckets: string[] = [],
): PhotoDayItem[] {
  // Hoist static data fetching out of loop if possible, or cache it.
  // Actually, filter callback runs per item. We can't easily hoist OUT of `items.filter`
  // However, calling it repeatedly inside the loop is still overhead if it does property access.
  // Ideally, we should fetch it once.


  // Check if we are in "Show All" mode (default)
  const isDefaultView = ALL_QUALITY_BUCKET_IDS.every((b) => selectedQualityBuckets.includes(b));

  return items.filter((item) => {
    if (item.type === "separator") {
      return showSeparators;
    }
    // item is ImageEntry
    const img = item as ImageEntry;

    // Quality Filter
    if (!isDefaultView) {
      // Strict filtering active
      const bucket = img.analysis?.qualityBucket;

      if (!bucket || !selectedQualityBuckets.includes(bucket)) {
        return false;
      }
    }


    if (selectedAuthors.length === 0) {
      return true; // No author filter applied
    }
    return selectedAuthors.includes(img.authorSlug || "");
  });
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
        // Separators might also contribute to locations if they have one
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

/**
 * Merges days with very few photos (<=2) into combined sections
 * to avoid massive headers for tiny content.
 */
export function mergeSparseDays(days: PhotoDay[]): PhotoDay[] {
  const result: PhotoDay[] = [];
  let pendingMerge: PhotoDay[] = [];

  const flushMerge = () => {
    if (pendingMerge.length === 0) return;

    if (pendingMerge.length === 1) {
      result.push(pendingMerge[0]);
      pendingMerge = [];
      return;
    }

    // Merge pending days
    // We take the ID/date of the first one as basic identity
    // but we add mergedDates to signal UI handling.
    const first = pendingMerge[0];
    const items = pendingMerge.flatMap((d) => d.items);
    const cities = Array.from(new Set(pendingMerge.flatMap((d) => d.cities ?? []))).filter(Boolean);
    const locations = Array.from(new Set(pendingMerge.flatMap((d) => d.locations ?? []))).filter(
      Boolean,
    );

    const merged: PhotoDay = {
      ...first,
      id: pendingMerge.map((d) => d.id ?? `day-${d.date}`).join("--"),
      items,
      cities,
      locations,
      mergedDates: pendingMerge.map((d) => d.date),
    };

    result.push(merged);
    pendingMerge = [];
  };

  for (const day of days) {
    // Threshold: 2 photos or fewer (count only images)
    const imageCount = day.items.filter((i) => i.type === "image").length;

    if (imageCount <= 2) {
      pendingMerge.push(day);
    } else {
      flushMerge();
      result.push(day);
    }
  }
  flushMerge();

  return result;
}

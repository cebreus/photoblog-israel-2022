import type { ImageEntry, PhotoDay, PhotoDayItem } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";

export type AestheticBucket = "excellent" | "good" | "poor";

export function getAestheticBucket(score: number | undefined): AestheticBucket | null {
  if (score === undefined) return null;
  if (score >= 0.03) return "excellent";
  if (score >= 0) return "good";
  return "poor";
}

export const AESTHETIC_BUCKETS: { id: AestheticBucket; label: string; min: number }[] = [
  { id: "excellent", label: "Excelentní", min: 0.03 },
  { id: "good", label: "Dobré", min: 0 },
  { id: "poor", label: "Podprůměrné", min: -Infinity }, // or just fallback
];

export function filterGalleryItems(
  items: PhotoDayItem[],
  selectedAuthors: string[],
  showSeparators: boolean,
  selectedAestheticBuckets: string[] = [],
): PhotoDayItem[] {
  return items.filter((item) => {
    if (item.type === "separator") {
      return showSeparators;
    }
    // item is ImageEntry
    const img = item as ImageEntry;

    // Aesthetic Score Filter (Bucket-based)
    // Aesthetic Score Filter (Bucket-based)
    // Logic:
    // 1. If currently selected buckets match the full set of defaults ("excellent", "good", "poor"),
    //    we assume the user wants to see "everything", including unrated photos. (Default View)
    // 2. If the user has explicitly deselected some buckets (subset), we switch to strict mode:
    //    only show photos that strictly match the remaining selected buckets. Unrated photos are hidden.

    // Check if we are in "Show All" mode (default)
    const allBuckets = ["excellent", "good", "poor"];
    const isDefaultView = allBuckets.every((b) => selectedAestheticBuckets.includes(b));

    if (!isDefaultView) {
      // Strict filtering active
      const score = img.analysis?.aestheticScore;
      const bucket = getAestheticBucket(score);

      if (!bucket || !selectedAestheticBuckets.includes(bucket)) {
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

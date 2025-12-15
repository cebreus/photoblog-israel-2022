import type { ImageEntry, PhotoDayItem, PhotoDay } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";

export function filterGalleryItems(
  items: PhotoDayItem[],
  selectedAuthors: string[],
  showSeparators: boolean,
): PhotoDayItem[] {
  return items.filter((item) => {
    if (item.type === "separator") {
      return showSeparators;
    }
    // item is ImageEntry
    if (selectedAuthors.length === 0) {
      return true; // No author filter applied
    }
    return selectedAuthors.includes((item as ImageEntry).authorSlug || "");
  });
}

export function computeTotals(
  selectedAuthors: string[],
  showSeparators: boolean,
  photoDaysData: PhotoDay[] = getPhotoDays(),
): { visiblePhotos: number; totalLocations: number } {
  let visiblePhotos = 0;
  const uniqueLocations = new Set<string>();

  const allPhotoDays = photoDaysData;

  for (const day of allPhotoDays) {
    const filteredItems = filterGalleryItems(day.items, selectedAuthors, showSeparators);

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

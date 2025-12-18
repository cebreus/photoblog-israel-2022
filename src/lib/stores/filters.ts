import type { QualityBucket } from "$lib/types/manifest";
import { computeTotals, filterGalleryItems, QUALITY_BUCKETS } from "$lib/utils/gallery";
import { getPhotoDays } from "$lib/utils/images";
import { derived, writable } from "svelte/store";

export const selectedAuthors = writable<string[]>([]);
export const selectedPeople = writable<string[]>([]);
export const showSeparators = writable(true);
export const selectedQualityBuckets = writable<QualityBucket[]>(QUALITY_BUCKETS.map((b) => b.id));
export const filtersSyncing = writable(false);

function filterPhotoDay(
  selectedAuthors: string[],
  showSeparators: boolean,
  selectedQualityBuckets: QualityBucket[],
  selectedPeople: string[],
) {
  return function applyFiltersToDay(day: any) {
    return {
      ...day,
      items: filterGalleryItems(
        day.items,
        selectedAuthors,
        showSeparators,
        selectedQualityBuckets,
        selectedPeople,
      ),
    };
  };
}

function isNotEmptyDay(day: any): boolean {
  return day.items && day.items.length > 0;
}

export const filteredPhotoDays = derived(
  [selectedAuthors, showSeparators, selectedQualityBuckets, selectedPeople],
  ([$selectedAuthors, $showSeparators, $selectedQualityBuckets, $selectedPeople]) => {
    const days = getPhotoDays();
    return days
      .map(
        filterPhotoDay($selectedAuthors, $showSeparators, $selectedQualityBuckets, $selectedPeople),
      )
      .filter(isNotEmptyDay);
  },
);

export const visiblePhotos = derived(
  [selectedAuthors, showSeparators, selectedQualityBuckets, selectedPeople],
  ([$selectedAuthors, $showSeparators, $selectedQualityBuckets, $selectedPeople]) =>
    computeTotals($selectedAuthors, $showSeparators, $selectedQualityBuckets, $selectedPeople)
      .visiblePhotos,
);

export const totalLocations = derived(
  [selectedAuthors, showSeparators, selectedQualityBuckets, selectedPeople],
  ([$selectedAuthors, $showSeparators, $selectedQualityBuckets, $selectedPeople]) =>
    computeTotals($selectedAuthors, $showSeparators, $selectedQualityBuckets, $selectedPeople)
      .totalLocations,
);

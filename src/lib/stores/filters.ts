import type { QualityBucket } from "$lib/types/manifest";
import { computeTotals, filterGalleryItems, QUALITY_BUCKETS } from "$lib/utils/gallery";
import { getPhotoDays } from "$lib/utils/images";
import { derived, writable } from "svelte/store";

export const selectedAuthors = writable<string[]>([]);
export const selectedPeople = writable<string[]>([]);
export const showSeparators = writable(true);
// Default to all buckets selected (subtractive logic)
export const selectedQualityBuckets = writable<QualityBucket[]>(QUALITY_BUCKETS.map((b) => b.id));
export const filtersSyncing = writable(false);

// Derived store that returns the photoDays with each day's items filtered
export const filteredPhotoDays = derived(
  [selectedAuthors, showSeparators, selectedQualityBuckets, selectedPeople],
  ([$selectedAuthors, $showSeparators, $selectedQualityBuckets, $selectedPeople]) => {
    const days = getPhotoDays();
    return days
      .map((day) => ({
        ...day,
        items: filterGalleryItems(
          day.items,
          $selectedAuthors,
          $showSeparators,
          $selectedQualityBuckets,
          $selectedPeople,
        ),
      }))
      .filter((d) => d.items && d.items.length > 0);
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

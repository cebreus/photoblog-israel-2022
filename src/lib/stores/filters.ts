import { AESTHETIC_BUCKETS, computeTotals, filterGalleryItems } from "$lib/utils/gallery";
import { getPhotoDays } from "$lib/utils/images";
import { derived, writable } from "svelte/store";

export const selectedAuthors = writable<string[]>([]);
export const showSeparators = writable(true);
// Default to all buckets selected (subtractive logic)
export const selectedAestheticBuckets = writable<string[]>(AESTHETIC_BUCKETS.map((b) => b.id));
export const filtersSyncing = writable(false);

// Derived store that returns the photoDays with each day's items filtered
export const filteredPhotoDays = derived(
  [selectedAuthors, showSeparators, selectedAestheticBuckets],
  ([$selectedAuthors, $showSeparators, $selectedAestheticBuckets]) => {
    const days = getPhotoDays();
    return days
      .map((day) => ({
        ...day,
        items: filterGalleryItems(
          day.items,
          $selectedAuthors,
          $showSeparators,
          $selectedAestheticBuckets,
        ),
      }))
      .filter((d) => d.items && d.items.length > 0);
  },
);

export const visiblePhotos = derived(
  [selectedAuthors, showSeparators, selectedAestheticBuckets],
  ([$selectedAuthors, $showSeparators, $selectedAestheticBuckets]) =>
    computeTotals($selectedAuthors, $showSeparators, $selectedAestheticBuckets)
      .visiblePhotos,
);

export const totalLocations = derived(
  [selectedAuthors, showSeparators, selectedAestheticBuckets],
  ([$selectedAuthors, $showSeparators, $selectedAestheticBuckets]) =>
    computeTotals($selectedAuthors, $showSeparators, $selectedAestheticBuckets)
      .totalLocations,
);

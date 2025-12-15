import { writable, derived } from "svelte/store";
import { filterGalleryItems, computeTotals } from "$lib/utils/gallery";
import { getPhotoDays } from "$lib/utils/images";

export const selectedAuthors = writable<string[]>([]);
export const showSeparators = writable(true);
export const filtersSyncing = writable(false);

// Derived store that returns the photoDays with each day's items filtered
export const filteredPhotoDays = derived(
  [selectedAuthors, showSeparators],
  ([$selectedAuthors, $showSeparators]) => {
    const days = getPhotoDays();
    return days
      .map((day) => ({
        ...day,
        items: filterGalleryItems(day.items, $selectedAuthors, $showSeparators),
      }))
      .filter((d) => d.items && d.items.length > 0);
  },
);

export const visiblePhotos = derived(
  [selectedAuthors, showSeparators],
  ([$selectedAuthors, $showSeparators]) =>
    computeTotals($selectedAuthors, $showSeparators).visiblePhotos,
);

export const totalLocations = derived(
  [selectedAuthors, showSeparators],
  ([$selectedAuthors, $showSeparators]) =>
    computeTotals($selectedAuthors, $showSeparators).totalLocations,
);

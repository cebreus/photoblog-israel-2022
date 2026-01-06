import type { MediaItemType, PhotoDay, QualityFilterBucket } from "$lib/types/manifest";
import { buildImagePeopleMap, computeTotals, filterGalleryItems } from "$lib/utils/gallery";
import { manifest } from "./manifest.svelte";

/** All available media types for filtering */
export const MEDIA_TYPES: { id: MediaItemType; label: string }[] = [
  { id: "image", label: "Fotografie" },
  { id: "panorama", label: "Panoramata" },
  { id: "sequence", label: "Sekvence" },
  { id: "collage", label: "Koláže" },
];

// Module-level state
let selectedAuthors = $state<string[]>([]);
let selectedPeople = $state<string[]>([]);
let showSeparators = $state(true);
let selectedQualityBuckets = $state<QualityFilterBucket[]>([]);
/** Media types to show (photo, panorama, sequence). Empty = all. */
let selectedMediaTypes = $state<MediaItemType[]>([]);
/** Show snapshots made by others (default: visible) */
let showOthersSnapshots = $state(true);
/** Show snapshots made by the author (default: visible) */
let showAuthorSnapshots = $state(true);
/** Show ONLY snapshots (hide all regular photos) */
let onlySnapshots = $state(false);
let filtersSyncing = $state(false);
/** Default expanded sections: none */
let accordionValue = $state<string[]>([]);

/** Source data for filtering - derived from centralized manifest store */
const sourceData = $derived(manifest.photoDays);

function reset() {
  selectedAuthors = [];
  selectedQualityBuckets = [];
  selectedPeople = [];
  selectedMediaTypes = [];
  onlySnapshots = false;
}

// Derived state
const filteredPhotoDays = $derived.by(() => {
  const criteria = {
    selectedAuthors,
    showSeparators,
    selectedQualityBuckets,
    selectedPeople,
    selectedMediaTypes,
    showOthersSnapshots,
    showAuthorSnapshots,
    onlySnapshots,
  };

  const imagePeopleMap = buildImagePeopleMap(sourceData);

  return sourceData
    .map((day) => ({
      ...day,
      items: filterGalleryItems(day.items, criteria, imagePeopleMap),
    }))
    .filter((day) => day.items && day.items.length > 0);
});

const stats = $derived.by(() => {
  return computeTotals(
    {
      selectedAuthors,
      showSeparators,
      selectedQualityBuckets,
      selectedPeople,
      selectedMediaTypes,
      showOthersSnapshots,
      showAuthorSnapshots,
      onlySnapshots,
    },
    sourceData,
  );
});

export const filters = {
  get selectedAuthors() {
    return selectedAuthors;
  },
  set selectedAuthors(v) {
    selectedAuthors = v;
  },

  get selectedPeople() {
    return selectedPeople;
  },
  set selectedPeople(v) {
    selectedPeople = v;
  },

  get showSeparators() {
    return showSeparators;
  },
  set showSeparators(v) {
    showSeparators = v;
  },

  get selectedQualityBuckets() {
    return selectedQualityBuckets;
  },
  set selectedQualityBuckets(v) {
    selectedQualityBuckets = v;
  },

  get selectedMediaTypes() {
    return selectedMediaTypes;
  },
  set selectedMediaTypes(v) {
    selectedMediaTypes = v;
  },

  get showOthersSnapshots() {
    return showOthersSnapshots;
  },
  set showOthersSnapshots(v) {
    showOthersSnapshots = v;
  },

  get showAuthorSnapshots() {
    return showAuthorSnapshots;
  },
  set showAuthorSnapshots(v) {
    showAuthorSnapshots = v;
  },

  get onlySnapshots() {
    return onlySnapshots;
  },
  set onlySnapshots(v) {
    onlySnapshots = v;
  },

  // Accordion Persistence
  get accordionValue() {
    return accordionValue;
  },
  set accordionValue(v) {
    accordionValue = v;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("filters-accordion-state", JSON.stringify(v));
    }
  },

  get filtersSyncing() {
    return filtersSyncing;
  },
  set filtersSyncing(v) {
    filtersSyncing = v;
  },

  get sourceData() {
    return sourceData;
  },
  // Deprecated: No-op, data is driven by manifest store
  setSourceData(_data: PhotoDay[]) {
    // No-op
  },

  get filteredPhotoDays() {
    return filteredPhotoDays;
  },
  get visiblePhotos() {
    return stats.visiblePhotos;
  },
  get totalLocations() {
    return stats.totalLocations;
  },

  reset,
  initPersistence,
};

function initPersistence() {
  if (typeof localStorage === "undefined") return;

  try {
    const raw = localStorage.getItem("filters-accordion-state");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        accordionValue = parsed;
      }
    }
  } catch (_e) {
    // Silent fail for local storage
  }
}

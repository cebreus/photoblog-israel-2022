import {
  isImageEntry,
  type MediaItemType,
  type PhotoDay,
  type QualityFilterBucket,
} from "$lib/types/manifest";
import { computeTotals, filterGalleryItems } from "$lib/utils/gallery";
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
/** Show snapshots made by others (default: hidden) */
let showOthersSnapshots = $state(false);
/** Show snapshots made by the author (default: hidden) */
let showAuthorSnapshots = $state(false);
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
const filteredPhotoDays = $derived.by(function calculateFilteredDays() {
  const criteria = {
    selectedAuthors: new Set(selectedAuthors),
    showSeparators,
    selectedQualityBuckets: new Set(selectedQualityBuckets),
    selectedPeople: new Set(selectedPeople),
    selectedMediaTypes: new Set(selectedMediaTypes.length === 0 ? [] : selectedMediaTypes), // Explicitly handle empty
    showOthersSnapshots,
    showAuthorSnapshots,
    onlySnapshots,
  };

  // Convert empty "media types" array to a Set that represents "all" (empty set handled in filter logic)
  if (selectedMediaTypes.length > 0) {
    criteria.selectedMediaTypes = new Set(selectedMediaTypes);
  } else {
    criteria.selectedMediaTypes = new Set();
  }

  function filterDayItems(day: PhotoDay) {
    return {
      ...day,
      items: filterGalleryItems(day.items, criteria),
    };
  }

  function hasItems(day: PhotoDay) {
    return day.items && day.items.some(isImageEntry);
  }

  return sourceData.map(filterDayItems).filter(hasItems);
});

const stats = $derived.by(function calculateStats() {
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

  // --- ACTIONS ---

  // Authors
  setAuthorSolo(slug: string) {
    selectedAuthors = [slug];
  },
  setAuthorsAll() {
    selectedAuthors = [];
  },
  setAuthorsNone() {
    selectedAuthors = ["none"];
  },

  // Media Types
  setMediaTypeSolo(type: MediaItemType) {
    selectedMediaTypes = [type];
  },
  setMediaTypesAll() {
    selectedMediaTypes = [];
  },
  setMediaTypesNone() {
    selectedMediaTypes = ["none" as MediaItemType];
  },

  // People
  setPersonSolo(id: string) {
    selectedPeople = [id];
  },
  setPeopleAll() {
    selectedPeople = [];
  },
  setPeopleWithPeople() {
    selectedPeople = ["__with_people__"];
  },
  setPeopleNone() {
    selectedPeople = ["__without_people__"];
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

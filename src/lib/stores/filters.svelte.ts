import type { MediaItemType, QualityBucket } from "$lib/types/manifest";
import { computeTotals, filterGalleryItems, QUALITY_BUCKETS } from "$lib/utils/gallery";
import { getPhotoDays } from "$lib/utils/images";

/** All available media types for filtering */
export const MEDIA_TYPES: { id: MediaItemType; label: string }[] = [
  { id: "image", label: "Fotografie" },
  { id: "panorama", label: "Panoramata" },
  { id: "sequence", label: "Sekvence" },
];

/** All media type IDs for "select all" logic */
const _ALL_MEDIA_TYPE_IDS = MEDIA_TYPES.map(function getId(t) {
  return t.id;
});

export class FilterState {
  selectedAuthors = $state<string[]>([]);
  selectedPeople = $state<string[]>([]);
  showSeparators = $state(true);
  selectedQualityBuckets = $state<QualityBucket[]>(
    QUALITY_BUCKETS.map(function getId(b) {
      return b.id;
    }),
  );
  /** Media types to show (photo, panorama, sequence). Empty = all. */
  selectedMediaTypes = $state<MediaItemType[]>([]);
  /** Show snapshots made by others (default: hidden) */
  showOthersSnapshots = $state(false);
  filtersSyncing = $state(false);

  filteredPhotoDays = $derived.by(
    function computeFilteredDays(this: FilterState) {
      const days = getPhotoDays();
      const self = this;
      return days
        .map(function mapDay(day) {
          return {
            ...day,
            items: filterGalleryItems(
              day.items,
              self.selectedAuthors,
              self.showSeparators,
              self.selectedQualityBuckets,
              self.selectedPeople,
              self.selectedMediaTypes,
              self.showOthersSnapshots,
            ),
          };
        })
        .filter(function hasItems(day) {
          return day.items && day.items.length > 0;
        });
    }.bind(this),
  );

  stats = $derived.by(
    function computeStats(this: FilterState) {
      return computeTotals(
        this.selectedAuthors,
        this.showSeparators,
        this.selectedQualityBuckets,
        this.selectedPeople,
      );
    }.bind(this),
  );

  visiblePhotos = $derived(this.stats.visiblePhotos);
  totalLocations = $derived(this.stats.totalLocations);

  setSelectedAuthors(authors: string[]) {
    this.selectedAuthors = authors;
  }

  setSelectedPeople(people: string[]) {
    this.selectedPeople = people;
  }

  setShowSeparators(value: boolean) {
    this.showSeparators = value;
  }

  setSelectedQualityBuckets(buckets: QualityBucket[]) {
    this.selectedQualityBuckets = buckets;
  }

  setSelectedMediaTypes(types: MediaItemType[]) {
    this.selectedMediaTypes = types;
  }

  setShowOthersSnapshots(value: boolean) {
    this.showOthersSnapshots = value;
  }

  setFiltersSyncing(value: boolean) {
    this.filtersSyncing = value;
  }
}

export const filters = new FilterState();

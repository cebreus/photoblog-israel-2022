import type { QualityBucket } from "$lib/types/manifest";
import { computeTotals, filterGalleryItems, QUALITY_BUCKETS } from "$lib/utils/gallery";
import { getPhotoDays } from "$lib/utils/images";

export class FilterState {
  selectedAuthors = $state<string[]>([]);
  selectedPeople = $state<string[]>([]);
  showSeparators = $state(true);
  selectedQualityBuckets = $state<QualityBucket[]>(QUALITY_BUCKETS.map((b) => b.id));
  filtersSyncing = $state(false);

  filteredPhotoDays = $derived.by(() => {
    const days = getPhotoDays();
    return days
      .map((day) => ({
        ...day,
        items: filterGalleryItems(
          day.items,
          this.selectedAuthors,
          this.showSeparators,
          this.selectedQualityBuckets,
          this.selectedPeople,
        ),
      }))
      .filter((day) => day.items && day.items.length > 0);
  });

  stats = $derived.by(() => {
    return computeTotals(
      this.selectedAuthors,
      this.showSeparators,
      this.selectedQualityBuckets,
      this.selectedPeople,
    );
  });

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

  setFiltersSyncing(value: boolean) {
    this.filtersSyncing = value;
  }
}

export const filters = new FilterState();

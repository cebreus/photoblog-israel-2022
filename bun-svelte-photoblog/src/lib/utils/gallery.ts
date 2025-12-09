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
    const filteredItems = filterGalleryItems(
      day.items,
      selectedAuthors,
      showSeparators,
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

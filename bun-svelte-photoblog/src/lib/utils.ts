import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  ImageEntry,
  PhotoDayItem,
  PhotoDay,
  Separator,
} from "./types/manifest"; // Added this
import { getPhotoDays } from "./images"; // Added this

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pluralizeCzech(
  count: number,
  forms: [string, string, string],
): string {
  if (count === 1) return forms[0];
  if (count >= 2 && count <= 4) return forms[1];
  return forms[2];
}

/**
 * Convenience helper to output a localized count plus the correct pluralized
 * noun form, e.g. `pluralizeCount(3, ['den','dny','dní'])` -> "3 dny".
 */
export function pluralizeCount(
  count: number,
  forms: [string, string, string],
): string {
  return `${count} ${pluralizeCzech(count, forms)}`;
}

import slugify from "slugify";

/**
 * Convert a display author name into a URL-safe slug. We keep this simple and
 * deterministic so it can be used in query params and mapping.
 */
export function toSlug(name: string): string {
  return slugify(name || "", { lower: true, strict: true });
}

// utility helpers

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

// --- From date-utils.ts ---
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  // Use Intl.DateTimeFormat for a more native and locale-aware solution
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatWeekdayCzech(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("cs-CZ", { weekday: "long" }).format(date);
}

// --- From filter-utils.ts ---
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

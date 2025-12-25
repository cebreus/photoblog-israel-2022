/**
 * @fileoverview Grid Action Utilities
 *
 * Extracted from PhotoGrid.svelte for reusability and testability.
 * Contains helper functions for grid operations like metadata paste.
 */

import type { ImageEntry } from "$lib/types/manifest";

/**
 * Metadata fields that can be copied/pasted between images.
 */
export interface MetadataFields {
  title?: string;
  author?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  caption?: string;
  keywords?: string[];
}

/**
 * Builds the update payload for metadata paste operation.
 * Only includes fields that are both selected AND have values in clipboard.
 */
export function buildMetadataUpdatePayload(
  fieldsToApply: Record<string, boolean>,
  clipboardData: MetadataFields,
): Partial<MetadataFields> {
  return {
    title: fieldsToApply.title && clipboardData.title ? clipboardData.title : undefined,
    author: fieldsToApply.author && clipboardData.author ? clipboardData.author : undefined,
    location: fieldsToApply.location && clipboardData.location ? clipboardData.location : undefined,
    city: fieldsToApply.city && clipboardData.city ? clipboardData.city : undefined,
    state: fieldsToApply.state && clipboardData.state ? clipboardData.state : undefined,
    country: fieldsToApply.country && clipboardData.country ? clipboardData.country : undefined,
    countryCode:
      fieldsToApply.countryCode && clipboardData.countryCode
        ? clipboardData.countryCode
        : undefined,
    caption: fieldsToApply.caption && clipboardData.caption ? clipboardData.caption : undefined,
    keywords:
      fieldsToApply.keywords && clipboardData.keywords?.length ? clipboardData.keywords : undefined,
  };
}

/**
 * Maps images to the format expected by the API.
 */
export function mapImagesToApiFormat(images: ImageEntry[]): { id: string; src: string }[] {
  return images.map((img) => ({
    id: img.id,
    src: img.src,
  }));
}

/**
 * Filters images based on exclusion list.
 */
export function filterExcludedImages(images: ImageEntry[], excludedIds: string[]): ImageEntry[] {
  return images.filter((img) => !excludedIds.includes(img.id));
}

/**
 * Removes IDs from a selection set that are in the given list.
 * Returns a new Set with the remaining IDs.
 */
export function removeFromSelection(
  currentSelection: Set<string>,
  idsToRemove: Iterable<string>,
): Set<string> {
  const newSelection = new Set(currentSelection);
  for (const id of idsToRemove) {
    newSelection.delete(id);
  }
  return newSelection;
}

/**
 * Filters display items to get only selected images.
 */
export function getSelectedImages(
  items: Array<{ type: string; id?: string }>,
  selection: Set<string>,
): ImageEntry[] {
  return items.filter(
    (item): item is ImageEntry => item.type === "image" && selection.has(item.id || ""),
  );
}

import type { ImageEntry, Separator } from "$lib/types/manifest";
// we use canonical top-level author strings (no normalization)

/**
 * Filters photo day items by the enabled authors and separator toggle.
 */
export function filterGalleryItems(
  items: (ImageEntry | Separator)[],
  authors: string[],
  includeSeparators: boolean,
) {
  // Work with normalized forms to avoid case / whitespace mismatches
  // NOTE: we rely on canonical top-level author strings (no normalization)
  // hasAuthorFilter = whether any authors are selected
  const hasAuthorFilter = authors.length > 0;

  return items.filter((item) => {
    if (item.type === "separator") {
      return includeSeparators;
    }

    // If the active selection is empty (e.g. user toggled off last author),
    // return false so nothing is shown.
    if (!hasAuthorFilter) return false;

    // Allow top-level author or EXIF fallback
    // Use canonical top-level author only (do not fall back to exif.author)
    const imageAuthor = item.type === "image" ? item.author : undefined;

    if (!imageAuthor) {
      return false;
    }

    // If there is no author on the image and the author filter is active,
    // we hide images that do not belong to any selected authors.
    return authors.includes(imageAuthor);
  });
}

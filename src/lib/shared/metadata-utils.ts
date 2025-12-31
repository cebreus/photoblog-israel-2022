import type { ImageEntry } from "$lib/types/manifest";

/**
 * Applies updates to an ImageEntry object.
 * This function is shared between client (for optimistic updates) and server (for persistence).
 * It handles normalization, initialization of nested objects, and deletion of null values.
 */
export function applyMetadataUpdates(
  imageItem: ImageEntry,
  updates: Record<string, string | string[] | null | undefined>,
) {
  if (updates.title !== undefined) {
    if (!imageItem.exif) imageItem.exif = {};
    if (updates.title === null) {
      if (imageItem.exif) delete imageItem.exif.title;
    } else {
      if (imageItem.exif) imageItem.exif.title = updates.title as string;
    }
  }

  if (updates.author !== undefined) {
    if (updates.author === null) delete imageItem.author;
    else imageItem.author = updates.author as string;

    // Sync with EXIF if present
    if (imageItem.exif) {
      if (updates.author === null) delete imageItem.exif.author;
      else imageItem.exif.author = updates.author as string;
    }
  }

  if (updates.location !== undefined) {
    if (updates.location === null) delete imageItem.location;
    else imageItem.location = updates.location as string;

    if (imageItem.exif) {
      if (updates.location === null) delete imageItem.exif.location;
      else imageItem.exif.location = updates.location as string;
    }
  }

  if (updates.city !== undefined) {
    if (updates.city === null) delete imageItem.city;
    else imageItem.city = updates.city as string;

    if (imageItem.exif) {
      if (updates.city === null) delete imageItem.exif.city;
      else imageItem.exif.city = updates.city as string;
    }
  }

  if (updates.state !== undefined) {
    if (!imageItem.exif) imageItem.exif = {};
    if (updates.state === null) {
      if (imageItem.exif) delete imageItem.exif.state;
    } else {
      if (imageItem.exif) imageItem.exif.state = updates.state as string;
    }
  }

  if (updates.country !== undefined) {
    if (!imageItem.exif) imageItem.exif = {};
    if (updates.country === null) {
      if (imageItem.exif) delete imageItem.exif.country;
    } else {
      if (imageItem.exif) imageItem.exif.country = updates.country as string;
    }
  }

  if (updates.countryCode !== undefined) {
    if (!imageItem.exif) imageItem.exif = {};
    if (updates.countryCode === null) {
      if (imageItem.exif) delete imageItem.exif.countryCode;
    } else {
      if (imageItem.exif) imageItem.exif.countryCode = updates.countryCode as string;
    }
  }

  if (updates.caption !== undefined) {
    if (updates.caption === null) delete imageItem.caption;
    else imageItem.caption = updates.caption as string;

    if (imageItem.exif) {
      if (updates.caption === null) delete imageItem.exif.caption;
      else imageItem.exif.caption = updates.caption as string;
    }
  }

  if (updates.keywords !== undefined) {
    if (updates.keywords === null) {
      delete imageItem.keywords;
    } else {
      imageItem.keywords = Array.isArray(updates.keywords)
        ? updates.keywords
        : [updates.keywords as string];
    }

    if (imageItem.exif) {
      if (updates.keywords === null) delete imageItem.exif.keywords;
      else imageItem.exif.keywords = imageItem.keywords;
    }
  }

  if (updates.flags !== undefined) {
    if (updates.flags === null) {
      delete imageItem.flags;
    } else {
      imageItem.flags = Array.isArray(updates.flags) ? updates.flags : [updates.flags as string];
    }
  }
}

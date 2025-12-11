import { writable } from "svelte/store";
import type { ImageEntry } from "$lib/types/manifest";

export interface MetadataClipboard {
  sourceImage: ImageEntry | null;
  data: {
    title?: string;
    author?: string;
    location?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    caption?: string;
    keywords?: string[];
  } | null;
}

const initialState: MetadataClipboard = {
  sourceImage: null,
  data: null,
};

function createMetadataClipboard() {
  const { subscribe, set, update } = writable<MetadataClipboard>(initialState);

  return {
    subscribe,

    copy(image: ImageEntry) {
      const metadata = {
        title: image.exif?.title,
        author: image.author,
        location: image.location,
        city: image.city,
        state: image.exif?.state,
        country: image.exif?.country,
        countryCode: image.exif?.countryCode,
        caption: image.caption,
        keywords: image.keywords,
      };

      set({
        sourceImage: image,
        data: metadata,
      });
    },

    clear() {
      set(initialState);
    },

    hasData() {
      let hasData = false;
      subscribe((state) => {
        hasData = state.data !== null;
      })();
      return hasData;
    },
  };
}

export const metadataClipboard = createMetadataClipboard();

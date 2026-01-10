import type { ImageEntry } from "$lib/types/manifest";

export interface MetadataClipboardData {
  title?: string;
  author?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  caption?: string;
  keywords?: string[];
  [key: string]: unknown;
}

function createMetadataClipboardState() {
  let sourceImage = $state<ImageEntry | null>(null);
  let data = $state<MetadataClipboardData | null>(null);

  function copy(image: ImageEntry) {
    const metadata: MetadataClipboardData = {
      title: image.title,
      author: image.author,
      location: image.location,
      city: image.city,
      state: image.exif?.state,
      country: image.exif?.country,
      countryCode: image.exif?.countryCode,
      caption: image.caption,
      keywords: image.keywords,
    };

    sourceImage = image;
    data = metadata;
  }

  function clear() {
    sourceImage = null;
    data = null;
  }

  return {
    get sourceImage() {
      return sourceImage;
    },
    set sourceImage(v) {
      sourceImage = v;
    },
    get data() {
      return data;
    },
    set data(v) {
      data = v;
    },
    get hasData() {
      return data !== null;
    },
    copy,
    clear,
  };
}

export const metadataClipboard = createMetadataClipboardState();

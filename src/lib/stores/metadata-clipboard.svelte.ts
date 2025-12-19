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
}

export class MetadataClipboardState {
  sourceImage = $state<ImageEntry | null>(null);
  data = $state<MetadataClipboardData | null>(null);

  copy(image: ImageEntry) {
    const metadata: MetadataClipboardData = {
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

    this.sourceImage = image;
    this.data = metadata;
  }

  clear() {
    this.sourceImage = null;
    this.data = null;
  }

  get hasData() {
    return this.data !== null;
  }
}

export const metadataClipboard = new MetadataClipboardState();

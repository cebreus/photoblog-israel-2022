/**
 * This file contains TypeScript types for the JSON manifests used in the application.
 * These types ensure that data loaded from `images.manifest.json` and `menu.manifest.json`
 * is strongly typed, preventing runtime errors and improving developer experience.
 */

/** Represents a single image source variant (e.g., a specific width in WebP or AVIF format). */
export type ImageSource = {
  variant: "default" | "xl" | "detail" | "fallback" | "placeholder";
  type: "image/webp" | "image/jpeg" | "image/avif" | "image/png";
  path: string;
  width?: number;
  height?: number; // Optional as not all variants might have it
};

/** Represents EXIF metadata extracted from an image. */
export type ExifData = {
  date: string;
  location?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  orientation?: string;
  // IPTC/XMP fields commonly used in the dataset
  title?: string;
  caption?: string;
  description?: string;
  keywords?: string[];
  author?: string;
  authorSlug?: string;
  copyright?: string;
  category?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  sublocation?: string;
};

/** Represents a single image entry in the manifest, including all its metadata and sources. */
export type ImageEntry = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  title: string;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
  placeholderColor?: string;
  placeholder?: string;
  // convenience top-level fields derived from EXIF/IPTC
  author?: string;
  authorSlug?: string; // canonical slug for author, added at build time
  keywords?: string[];
  caption?: string;
  // additional canonical convenience fields (mirrored from exif.* for runtime ease)
  date?: string; // ISO date string — canonical source for time
  location?: string; // canonical place/location (e.g., "Křižácká pevnost")
  city?: string; // canonical city
  latitude?: number;
  longitude?: number;
  description?: string; // normalized description / long caption
  copyright?: string;
  category?: string;
  googleMapsUrl?: string;
  mapyCzUrl?: string;
  exif?: {
    date?: string;
    location?: string;
    city?: string;
    sublocation?: string;
    latitude?: number;
    longitude?: number;
    orientation?: number;
    // preserve IPTC/XMP fields from the original files (optional)
    title?: string;
    caption?: string;
    description?: string;
    keywords?: string[];
    author?: string;
    copyright?: string;
    category?: string;
    country?: string;
    countryCode?: string;
    state?: string;
  };
  sources: ImageSource[];
};

/** Represents a separator in the photo grid, often used to denote a new location or section. */
export type Separator = {
  type: "separator";
  location: string;
  city: string;
  storyTitle?: string;
  story?: string;
  id: string;
};

/** A union type representing any possible item in a photo day's `items` array. */
export type PhotoDayItem = ImageEntry | Separator;

/** Represents a single day of photos, containing metadata and a list of items (images or separators). */
export type PhotoDay = {
  date: string;
  id: string;
  items: (ImageEntry | Separator)[];
  cities?: string[];
  locations?: string[];
  story?: string;
  mergedDates?: string[];
};

/** The root object of the entire `images.manifest.json`. */
export type Manifest = {
  photoDays: PhotoDay[];
};

/** Represents a location entry in the lightweight menu manifest. */
export type MenuLocation = {
  id: string;
  label: string;
  href: string;
  isActive?: boolean;
  isDimmed?: boolean;
  firstPhotoExifDate?: string;
};

/** Represents a day entry in the lightweight `menu.manifest.json`. */
export type MenuDay = {
  id: string;
  date: string;
  label: string;
  href: string;
  locations: MenuLocation[];
  items?: PhotoDayItem[];
};

export type MenuManifest = MenuDay[];

/** Represents global site settings from site.md */
export type SiteManifest = {
  favicon?: string;
  type?: string;
  copyright?: string;
  meta?: {
    lang?: string;
    charset?: string;
    author?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    robots?: string;
    include_to_sitemap?: boolean;
  };
  open_graph?: {
    use?: boolean;
    type?: string;
    app_id?: number;
    site_name?: string;
    image?: string[];
    image_text?: string;
  };
  twitter_cards?: {
    use?: boolean;
    type?: string;
    image?: string[];
    site?: string;
    creator?: string;
  };
  manifest?: {
    appName?: string;
    appShortName?: string;
    appDescription?: string;
    developerName?: string;
    developerURL?: string;
    background?: string;
    theme_color?: string;
    display?: string;
    orientation?: string;
    start_url?: string;
    version?: string;
    icons?: Record<string, boolean>;
  };
};

// --- Types for script/generate-images.ts ---

import { ImageFormat } from "./images";

export type QualityTypes =
  | typeof ImageFormat.JPEG
  | typeof ImageFormat.WEBP
  | typeof ImageFormat.AVIF;

export type ScriptArgs = {
  concurrency: number | "auto";
  limit: number;
  watch: boolean;
  clean: boolean;
  verbose: boolean;
  quiet: boolean;
  manifestOnly: boolean;
};

export type CacheFileEntry = {
  hash: string;
  mtimeMs: number;
  outputs: string[];
};

export type Cache = {
  version: number;
  configHash: string;
  files: {
    [key: string]: CacheFileEntry;
  };
};

export type StoryData = {
  title: string;
  content: string;
  location?: string;
  date?: string;
};

export type StoryDataMap = Record<string, StoryData>;

export type AspectRatio =
  | "square"
  | "sphere"
  | "panorama"
  | "landscape-16-9"
  | "landscape-3-2"
  | "landscape-4-3"
  | "portrait-9-16"
  | "portrait-2-3"
  | "portrait-3-4"
  | `landscape-${number}-${number}`
  | `portrait-${number}-${number}`;

export type Author = {
  name: string;
  count: number;
  slug?: string;
};

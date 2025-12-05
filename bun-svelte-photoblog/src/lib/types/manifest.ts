/**
 * This file contains TypeScript types for the JSON manifests used in the application.
 * These types ensure that data loaded from `images.manifest.json` and `menu.manifest.json`
 * is strongly typed, preventing runtime errors and improving developer experience.
 */

/** Represents a single image source variant (e.g., a specific width in WebP or AVIF format). */
export type ImageSource = {
  variant: 'default' | 'xl' | 'detail' | 'fallback';
  type: 'image/webp' | 'image/jpeg' | 'image/avif';
  path: string;
  width: number;
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
};

/** Represents a single image entry in the manifest, including all its metadata and sources. */
export type ImageEntry = {
  id: string;
  type: 'image';
  src: string;
  alt: string;
  title: string;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
  placeholderColor?: string;
  placeholder?: string;
  exif?: {
    date?: string;
    location?: string;
    city?: string;
    sublocation?: string;
    latitude?: number;
    longitude?: number;
    orientation?: number;
  };
  sources: ImageSource[];
};

/** Represents a separator in the photo grid, often used to denote a new location or section. */
export type Separator = {
  type: 'separator';
  location: string;
  city: string;
  storyContent?: string;
  id: string;
};

/** A union type representing any possible item in a photo day's `items` array. */
export type PhotoDayItem = ImageEntry | Separator;

/** Represents a single day of photos, containing metadata and a list of items (images or separators). */
export type PhotoDay = {
  date: string;
  id: string;
  items: (ImageEntry | Separator)[];
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

// --- Types for script/generate-images.ts ---

export type QualityTypes = 'jpeg' | 'webp' | 'avif';

export type ScriptArgs = {
  concurrency: number;
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
  location: string;
};

export type StoryDataMap = Record<string, StoryData>;

export type AspectRatio =
  | 'square'
  | 'panorama'
  | 'landscape-16-9'
  | 'landscape-3-2'
  | 'landscape-4-3'
  | 'portrait-9-16'
  | 'portrait-2-3'
  | 'portrait-3-4';

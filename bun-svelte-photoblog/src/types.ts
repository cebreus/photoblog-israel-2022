// Centralized TypeScript definitions for the photoblog project

// --- Core Manifest Structure ---

/** Represents a single image with all its generated variants. */
export type ImageEntry = {
  type: 'image';
  src: string; // Original source filename, e.g., "IMG_1234.jpg"
  alt: string;
  title: string;
  width: number | undefined;
  height: number | undefined;
  aspectRatio: string; // e.g., 'landscape', 'portrait', 'square', 'panorama'
  placeholder: string; // Path to a blurred, low-res placeholder image
  placeholderColor?: string; // Dominant color of the image as a CSS string
  sources: ImageSource[];
  exif: {
    date?: string;
    location?: string;
    city?: string;
    sublocation?: string;
    latitude?: number;
    longitude?: number;
    orientation?: number;
  };
};

/** A single source for a <picture> element, with variant key. */
export type ImageSource = {
  variant: string; // e.g., 'default', 'xl'
  type: string; // e.g., 'image/webp'
  path: string;
  width?: number; // Optional width for srcset
  height?: number;
};

/** Represents a visual separator in the photo grid, often containing location info. */
export type Separator = {
  type: 'separator';
  location: string;
  city: string;
  storyTitle?: string;
  storyContent?: string;
  id?: string; // optional unique id (slug) for linking
};

/** Represents a collection of photos and separators for a specific day. */
export type PhotoDay = {
  date: string; // YYYY-MM-DD
  items: (ImageEntry | Separator)[];
  id?: string; // optional unique id for the day (e.g., day-YYYY-MM-DD)
};

/** The root object of the entire `images.manifest.json`. */
export type Manifest = {
  photoDays: PhotoDay[];
};

// --- Script-Specific Types (for generate-images.ts) ---

/** Data parsed from a Markdown file's frontmatter for a specific image. */
export type StoryImageEntry = {
  title?: string;
  description?: string;
  tags?: string[];
};

/** Data parsed from a Markdown file's frontmatter. */
export type StoryData = {
  date: string;
  title?: string;
  story?: string;
  content?: string;
  images?: Record<string, StoryImageEntry>;
};

/** A dictionary mapping dates to their corresponding story data. */
export type StoryDataMap = Record<string, StoryData>;

/** Types of supported image output formats for quality settings. */
export type QualityTypes = 'jpeg' | 'webp' | 'avif';

/** Arguments passed to the generation script via CLI. */
export type ScriptArgs = {
  concurrency: number;
  watch: boolean;
  clean: boolean;
  verbose: boolean;
  quiet: boolean;
  limit: number;
  manifestOnly: boolean;
};

/** A single entry in the cache file, representing the state of a processed source file. */
export type CacheFileEntry = {
  hash: string;
  mtimeMs: number;
  outputs: string[];
};

/** The root object of the `.images-cache.json` file. */
export type Cache = {
  version: number;
  configHash: string;
  files: Record<string, CacheFileEntry>; // key is relative path from src root
};

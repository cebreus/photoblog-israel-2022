export type ImageSource = {
  variant: "default" | "xl" | "detail" | "fallback" | "placeholder" | "admin_thumb";
  type: "image/webp" | "image/jpeg" | "image/avif" | "image/png";
  path: string;
  width?: number;
  height?: number; // Optional as not all variants might have it
};

export type ExifData = {
  date: string;
  location?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  orientation?: string;
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
  adminThumbUrl?: string;
  author?: string;
  authorSlug?: string;
  keywords?: string[];
  caption?: string;
  date?: string;
  location?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  copyright?: string;
  category?: string;
  googleMapsUrl?: string;
  sizeMB?: number;

  analysis?: {
    aestheticScore?: number;
    sharpness: number;
    qualityBucket?: QualityBucket;
    phash: string;
    embedding?: number[];
    facesDetected?: boolean;
    faces?: Array<{ x: number; y: number; width: number; height: number }>;
  };

  exif?: {
    date?: string;
    location?: string;
    city?: string;
    sublocation?: string;
    latitude?: number;
    longitude?: number;
    orientation?: number;
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
  people?: string[];
  sources: ImageSource[];
};

export type Separator = {
  type: "separator";
  location: string;
  city: string;
  storyTitle?: string;
  story?: string;
  id: string;
};

export type PhotoDayItem = ImageEntry | Separator;

export type PhotoDay = {
  date: string;
  id: string;
  items: (ImageEntry | Separator)[];
  cities?: string[];
  locations?: string[];
  story?: string;
  mergedDates?: string[];
};

export type Manifest = {
  photoDays: PhotoDay[];
};

export type MenuLocation = {
  id: string;
  label: string;
  href: string;
  isActive?: boolean;
  isDimmed?: boolean;
  firstPhotoExifDate?: string;
};

export type QualityBucket = "excellent" | "good" | "poor";

export type MenuDay = {
  id: string;
  date: string;
  label: string;
  href: string;
  locations: MenuLocation[];
  items?: PhotoDayItem[];
};

export type CurationRecommendation = {
  action: "keep" | "delete";
  reason: string;
};

export type CurationGroup = {
  id: string;
  items: string[];
  bestCandidateId: string;
  similarity: number;
  recommendations: Record<string, CurationRecommendation>;
};

export type CurationManifest = {
  groups: CurationGroup[];
  stats: {
    totalPhotos: number;
    totalGroups: number;
    duplicatesFound: number;
  };
};

export type MenuManifest = MenuDay[];

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

import type { ImageFormat } from "./images";

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
  curation: boolean;
  skipFaces?: boolean;
  skipEmbeddings?: boolean;
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

export type Person = {
  id: string;
  name: string;
  faceDescriptor: number[];
  faceCount: number;
  thumbnail: string;
  manualImageIds?: string[];
  ignored: boolean;
  category?: "person" | "statue" | "painting";
  createdAt: string;
  lastSeenAt: string;
};

export type PeopleManifest = {
  people: Person[];
};

export type AnalysisEntry = {
  aestheticScore?: number;
  sharpness: number;
  qualityBucket?: QualityBucket;
  phash: string;
};

export type AnalysisManifest = {
  [imageId: string]: AnalysisEntry;
};

export type EmbeddingsManifest = {
  [imageId: string]: number[];
};

export type FaceDetail = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageFaces = {
  facesDetected: boolean;
  faces: FaceDetail[];
  peopleIds: string[];
};

export type FacesManifest = {
  [imageId: string]: ImageFaces;
};

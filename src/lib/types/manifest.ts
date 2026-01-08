// Re-export shared manifest types used across build and runtime
export * from "../../../shared/types/manifest";

// Import types for use in local types
import type { QualityBucket } from "../../../shared/types/manifest";

// ==========================================
// UI & App-Specific Types Below
// ==========================================

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
  filter?: string;
  force: boolean;
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

export type FaceCluster = {
  centroid: number[];
  faceCount: number;
  year?: number;
  lastSeen?: string;
};

export type Person = {
  id: string;
  name: string;
  /**
   * @deprecated Moved to face-embeddings.manifest.json for lazy loading.
   * This field is no longer populated in people.manifest.json after migration.
   */
  faceDescriptor?: number[];
  /**
   * @deprecated Moved to face-embeddings.manifest.json for lazy loading.
   * This field is no longer populated in people.manifest.json after migration.
   */
  clusters?: FaceCluster[];
  faceCount: number;
  thumbnail: string;
  manualImageIds?: string[];
  hidden: boolean;
  junk?: boolean;
  category?: "person" | "statue" | "painting";
  createdAt: string;
  lastSeenAt: string;
  /**
   * Indicates whether this person was explicitly named by the user.
   * If undefined, inferred from ID pattern (contains "--" in slug).
   * @since 2026-01-06
   */
  isUserNamed?: boolean;
};

export type PeopleManifest = {
  people: Person[];
};

export type QualityFilterBucket = QualityBucket | "unrated";

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

/**
 * Face embeddings for people (person-level descriptors).
 * Stores faceDescriptor and cluster centroids separately from people.manifest.json
 * to reduce manifest size and enable lazy loading.
 */
export type FaceEmbeddingsManifest = {
  [personId: string]: {
    /**
     * @deprecated Legacy single descriptor. Use clusters[0].centroid if available.
     */
    faceDescriptor?: number[];
    /**
     * Multiple cluster centroids for temporal/appearance variations.
     */
    clusters?: {
      centroid: number[];
      faceCount: number;
      year?: number;
      lastSeen?: string;
    }[];
  };
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
  /**
   * Cached 128-float descriptors for re-clustering without re-inference.
   * Optional to save space if not needed, but critical for fast incremental clustering.
   */
  descriptors?: number[][];
};

export type FacesManifest = {
  [imageId: string]: ImageFaces;
};

export type Constraint = {
  imageId: string;
  personId: string;
};

export type ClusteringConstraints = {
  disconnects: Constraint[];
  connects: Constraint[];
  invalidDetections?: Array<{
    imageId: string;
    box: { x: number; y: number; width: number; height: number };
  }>;
  ignoredCrops?: Array<{
    imageId: string;
    box: { x: number; y: number; width: number; height: number };
  }>;
};

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

export type Author = {
  name: string;
  count: number;
  slug?: string;
};

export type QualityFilterBucket = QualityBucket | "unrated";

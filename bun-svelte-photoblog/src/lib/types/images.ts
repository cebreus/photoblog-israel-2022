/**
 * Sdílené typy pro generování obrázků a runtime.
 * Používáno v generate-images.ts, images.ts, Picture.svelte a testech.
 */

export type Variant = {
  width: number;
  height: number;
  path: string;
  bytes: number;
};

export type VariantsByFormat = {
  avif?: Variant[];
  webp?: Variant[];
  jpeg?: Variant[];
};

export type Placeholder = {
  base64: string | null;
  width: number | null;
  height: number | null;
  type: string | null;
};

export type ManifestEntry = {
  original: {
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number;
    path: string | null;
  };
  variants: VariantsByFormat;
  placeholder: Placeholder | null;
  color: string | null;
  hash: string;
  outputs: string[];
};

export type Manifest = Record<string, ManifestEntry>;

// Generator-specific types
export type Quality = { avif: number; webp: number; jpeg: number };
export type GifMode = 'copy' | 'convert';
export type VariantType = 'details' | 'previews' | 'previews-xl' | 'previews-xxs';

export type VariantConfig = {
  folder: string;
  width?: number;
  height?: number;
  crop?: boolean;
  quality: Quality;
};

export type CacheFileEntry = {
  hash: string;
  width: number | null;
  height: number | null;
  format: string | null;
  mtimeMs: number;
  size: number;
  processedFormats: string[];
  outputs: string[];
};

export type Cache = {
  version: number;
  configHash: string;
  files: Record<string, CacheFileEntry>;
};

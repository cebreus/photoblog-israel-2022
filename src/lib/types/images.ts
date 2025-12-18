export const ImageFormat = {
  AVIF: "avif",
  WEBP: "webp",
  JPEG: "jpeg",
  PNG: "png",
} as const;
export type ImageFormat = (typeof ImageFormat)[keyof typeof ImageFormat];

export enum ImageVariant {
  DETAILS = "details",
  PREVIEWS = "previews",
  PREVIEWS_XL = "previews-xl",
  PREVIEWS_XXS = "previews-xxs",
}

export type Variant = {
  width: number;
  height: number;
  path: string;
  bytes: number;
};

export type VariantsByFormat = {
  [ImageFormat.AVIF]?: Variant[];
  [ImageFormat.WEBP]?: Variant[];
  [ImageFormat.JPEG]?: Variant[];
};

export type Placeholder = {
  base64: string | null;
  width: number | null;
  height: number | null;
  type: string | null;
};

export type Meta = {
  date: string | null;
  groupBy: string | null;
  city?: string | null;
  where?: string | null;
  country?: string | null;
  keywords?: string[] | string | null;
  objectName?: string | null;
  caption?: string | null;

  type?: string | null;
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
  meta?: Meta;
};

export type Manifest = Record<string, ManifestEntry>;

export type Quality = {
  [ImageFormat.AVIF]: number;
  [ImageFormat.WEBP]: number;
  [ImageFormat.JPEG]: number;
};
export type VariantType = `${ImageVariant}`;

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

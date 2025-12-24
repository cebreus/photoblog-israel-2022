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

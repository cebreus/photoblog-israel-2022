export const ImageFormat = {
    AVIF: "avif",
    WEBP: "webp",
    JPEG: "jpeg",
    JPG: "jpg",
    PNG: "png",
    HEIC: "heic",
    HEIF: "heif",
    SVG: "svg",
    ICO: "ico",
} as const;

export type ImageFormat = (typeof ImageFormat)[keyof typeof ImageFormat];

export const MIME_TYPES: Record<string, string> = {
    ".avif": "image/avif",
    ".webp": "image/webp",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json",
    ".md": "text/markdown",
};

export const HEIC_EXTENSIONS = [`.${ImageFormat.HEIC}`, `.${ImageFormat.HEIF}`] as const;

/**
 * Checks if the given extension (including dot) is a HEIC/HEIF format.
 */
export function isHeic(ext: string): boolean {
    return HEIC_EXTENSIONS.includes(ext.toLowerCase() as any);
}
export function isHeicFormat(format: string): boolean {
    return format === ImageFormat.HEIC || format === ImageFormat.HEIF;
}

export const JPEG_EXTENSIONS = [`.${ImageFormat.JPG}`, `.${ImageFormat.JPEG}`] as const;
export function isJpeg(ext: string): boolean {
    return JPEG_EXTENSIONS.includes(ext.toLowerCase() as any);
}
export function isJpegFormat(format: string): boolean {
    return format === ImageFormat.JPEG || format === ImageFormat.JPG;
}

export function isPng(ext: string): boolean {
    return ext.toLowerCase() === `.${ImageFormat.PNG}`;
}
export function isWebp(ext: string): boolean {
    return ext.toLowerCase() === `.${ImageFormat.WEBP}`;
}
export function isAvif(ext: string): boolean {
    return ext.toLowerCase() === `.${ImageFormat.AVIF}`;
}

export const RECOGNIZED_IMAGE_FORMATS = [
    ImageFormat.AVIF,
    ImageFormat.WEBP,
    ImageFormat.JPEG,
] as const;

export type RecognizedFormat = (typeof RECOGNIZED_IMAGE_FORMATS)[number];

export function isRecognizedFormat(format: string): format is RecognizedFormat {
    return RECOGNIZED_IMAGE_FORMATS.includes(format.toLowerCase() as any);
}

/**
 * Creates an empty map of variants for all recognized formats.
 */
export function createEmptyVariants<T>(): Record<RecognizedFormat, T[]> {
    return Object.fromEntries(RECOGNIZED_IMAGE_FORMATS.map((f) => [f, [] as T[]])) as Record<
        RecognizedFormat,
        T[]
    >;
}

/**
 * Normalizes image format (e.g. 'jpg' -> 'jpeg').
 */
export function normalizeFormat(format: string): string {
    const f = format.toLowerCase();
    if (f === "jpg") {
        return ImageFormat.JPEG;
    }
    return f;
}

export const SUPPORTED_INPUT_EXTENSIONS = [
    ImageFormat.JPG,
    ImageFormat.JPEG,
    ImageFormat.PNG,
    ImageFormat.WEBP,
    ImageFormat.AVIF,
    ImageFormat.HEIC,
    ImageFormat.HEIF,
];

export const SUPPORTED_OUTPUT_FORMATS = [
    ImageFormat.JPEG,
    ImageFormat.JPG,
    ImageFormat.WEBP,
    ImageFormat.AVIF,
    ImageFormat.PNG,
];

export const SEARCH_EXTENSIONS = [
    ...SUPPORTED_INPUT_EXTENSIONS.map((ext) => `.${ext}`),
    ...SUPPORTED_INPUT_EXTENSIONS.map((ext) => `.${ext.toUpperCase()}`),
];

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

export type VariantsByFormat = Partial<Record<RecognizedFormat, Variant[]>>;

export type Quality = Record<RecognizedFormat, number>;

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

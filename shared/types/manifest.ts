import type { ImageFormat } from "./images";

export type ImageSource = {
    variant: "default" | "xl" | "detail" | "fallback" | "placeholder" | "admin_thumb";
    type: "image/webp" | "image/jpeg" | "image/avif" | "image/png";
    path: string;
    width?: number;
    height?: number;
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

export type QualityBucket = "excellent" | "good" | "poor";

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

/** Type guard for ImageEntry */
export function isImageEntry(item: PhotoDayItem): item is ImageEntry {
    return item.type === "image";
}

/** Type guard for Separator */
export function isSeparator(item: PhotoDayItem): item is Separator {
    return item.type === "separator";
}

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

export type QualityTypes =
    | typeof ImageFormat.JPEG
    | typeof ImageFormat.WEBP
    | typeof ImageFormat.AVIF;

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

export type FaceCluster = {
    centroid: number[];
    faceCount: number;
    year?: number;
    lastSeen?: string;
};

export type Person = {
    id: string;
    name: string;
    faceDescriptor: number[]; // Deprecated, kept for compat. Use clusters[0].centroid if unsure.
    clusters: FaceCluster[];
    faceCount: number;
    thumbnail: string;
    manualImageIds?: string[];
    hidden: boolean;
    junk?: boolean;
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
    /**
     * Cached 128-float descriptors for re-clustering without re-inference.
     * Optional to save space if not needed, but critical for fast incremental clustering.
     */
    descriptors?: number[][];
};

export type FacesManifest = {
    [imageId: string]: ImageFaces;
};

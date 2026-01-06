import type { ImageFormat } from "./images";

export type ImageSource = {
    variant: "default" | "xl" | "detail" | "fallback" | "placeholder" | "admin_thumb" | "pano_detail";
    type: "image/webp" | "image/jpeg" | "image/avif" | "image/png";
    path: string;
    width?: number;
    height?: number;
};

export type ExifData = {
    date: string;
    releaseDate: string;
    location?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    orientation?: number; // Changed to number to match runtime usage
    copyright?: string;
    category?: string;
    country?: string;
    countryCode?: string;
    state?: string;
};

export type QualityBucket = "excellent" | "good" | "poor";

export type AspectRatio =
    | "square"
    | "sphere"
    | "panorama"
    | "collage"
    | "landscape-16-9"
    | "landscape-3-2"
    | "landscape-4-3"
    | "portrait-9-16"
    | "portrait-2-3"
    | "portrait-3-4"
    | `landscape-${number}-${number}`
    | `portrait-${number}-${number}`;

export type SequenceType = "zoom" | "pan" | "burst" | "timelapse" | "focus-stack" | "pano";

export type SequenceInfo = {
    type: SequenceType;
    index: number;
    total: number;
    baseId: string;
    /** All member IDs in this sequence, sorted by index. Populated at build time. */
    members?: string[];
};

export type MediaItemType = "image" | "sequence" | "sequence-member" | "panorama" | "collage" | "video" | "youtube";

/**
 * Image projection type used for rendering.
 */
export type ImageProjection =
    | "rectilinear"     // Standard flat image (default)
    | "equirectangular" // 360° sphere (2:1 ratio)
    | "cylindrical"     // Standard panorama (horizontal scrolling)
    | "fisheye"         // Fisheye lens
    | "stereographic";  // Little planet

/**
 * Metadata for special media types requiring custom viewers.
 */
export type SpecialMediaData = {
    isPanorama: boolean;
    is360: boolean;
    projection: ImageProjection;
    /** Horizontal Field of View in degrees */
    hfov?: number;
    /** Vertical Field of View in degrees */
    vfov?: number;
    /** Camera orientation (for compass) */
    pose?: {
        heading: number;
        pitch: number;
        roll: number;
    };
    /** Initial view settings */
    initialView?: {
        yaw: number;
        pitch: number;
        fov: number;
    };
};

/** @deprecated Use SpecialMediaData instead */
export type PanoramaConfig = {
    projection: "cylindrical" | "equirectangular";
    haov: number;
    vaov: number;
    hfov?: number;
    vOffset?: number;
};

export type ImageEntry = {
    id: string;
    type: MediaItemType;
    src: string;
    alt: string;
    title: string;
    width?: number;
    height?: number;
    aspectRatio?: AspectRatio;
    clap?: import("./clap").CleanApertureData;
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
        date: string;
        releaseDate: string;
        location?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
        orientation?: number;
        copyright?: string;
        category?: string;
        country?: string;
        countryCode?: string;
        state?: string;
    };
    people?: string[];
    sources: ImageSource[];
    specialMedia?: SpecialMediaData;
    /** @deprecated Use specialMedia instead */
    panoramaConfig?: PanoramaConfig;
    sequenceInfo?: SequenceInfo;
    /**
     * User-defined flags for filtering and categorization.
     * Examples: "snapshot-author", "snapshot-others", "favorite", "archived"
     */
    flags?: string[];
};

export type Separator = {
    type: "separator";
    location: string;
    city: string;
    storyTitle?: string;
    story?: string;
    id: string;
    startDate?: string;
    endDate?: string;
    hasPhotos?: boolean;
};

export type PhotoDayItem = ImageEntry | Separator;

/** Type guard for ImageEntry */
export function isImageEntry(item: PhotoDayItem): item is ImageEntry {
    return item.type !== "separator";
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

export type MenuLocation = {
    id: string;
    label: string;
    href: string;
    isActive?: boolean;
    isDimmed?: boolean;
    firstPhotoExifDate?: string;
    startDate?: string;
    endDate?: string;
};

export type MenuDay = {
    id: string;
    date: string;
    label: string;
    href: string;
    locations: MenuLocation[];
    items?: PhotoDayItem[];
};

export type MenuManifest = MenuDay[];

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
    city?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    visits?: Array<{ startDate?: string; endDate?: string }>;
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



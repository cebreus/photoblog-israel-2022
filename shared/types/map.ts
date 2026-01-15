/**
 * Type definitions for map manifest.
 * Optimized for minimal data transfer - only includes essential data for map rendering.
 */

export type MapImage = {
    /** Unique identifier of the image */
    id: string;
    /** Alt text for accessibility */
    alt: string;
    /** Path to detail variant for Fancybox */
    detail: string;
    /** Path to thumbnail for Fancybox gallery */
    thumb: string;
};

export type MapLocation = {
    /** Unique identifier (locationKey from grouping) */
    id: string;
    /** Latitude coordinate */
    lat: number;
    /** Longitude coordinate */
    lng: number;
    /** Location name (from exif.location or formatted coordinates) */
    name: string;
    /** Number of photos at this location */
    count: number;
    /** Path to fallback thumbnail for map marker */
    thumbnail: string;
    /** Images at this location */
    images: MapImage[];
    /** References to MenuLocation IDs for Agenda integration (1:N relationship) */
    menuLocationIds?: string[];
    /** Days when photos were taken at this location (ISO date strings: YYYY-MM-DD) */
    days?: string[];
};

export type MapManifest = {
    /** Metadata about manifest generation */
    meta: {
        /** Manifest version */
        version: number;
        /** Generation timestamp */
        generatedAt: string;
        /** Generator identifier */
        generator: string;
    };
    /** Array of locations with GPS coordinates */
    locations: MapLocation[];
};

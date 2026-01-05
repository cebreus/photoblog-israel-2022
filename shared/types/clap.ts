
/** 
 * Clean Aperture definition following HEIF/ISO 23008-12 spec.
 * All values are in pixels relative to the native (unrotated) image.
 * 
 * SOURCE OF TRUTH: The HEIC file itself (clap atom).
 * No manifest - read directly from file at build time.
 */
export interface CleanApertureData {
    /** Width of the visible area in pixels */
    width: number;
    /** Height of the visible area in pixels */
    height: number;
    /** Horizontal offset from center (positive = right) */
    horizOffset: number;
    /** Vertical offset from center (positive = down) */
    vertOffset: number;
}

/** 
 * User-space crop representation (after EXIF Orientation applied).
 * Used in the GUI editor, before transformation to native coordinates.
 */
export interface UserCrop {
    /** Left edge position (0-100%) */
    x: number;
    /** Top edge position (0-100%) */
    y: number;
    /** Width (0-100%) */
    width: number;
    /** Height (0-100%) */
    height: number;
}

import type { CleanApertureData, UserCrop } from "../types/clap";

/**
 * Converts native "clap" coordinates to user-space crop (percentages).
 * Takes EXIF Orientation into account.
 */
export function nativeClapToUserCrop(
    clap: CleanApertureData,
    nativeWidth: number,
    nativeHeight: number,
    orientation: number
): UserCrop {
    // 1. Calculate top-left from center offsets in native space
    const nativeLeft = nativeWidth / 2 + clap.horizOffset - clap.width / 2;
    const nativeTop = nativeHeight / 2 + clap.vertOffset - clap.height / 2;

    // 2. Map native (x, y, w, h) to user-space based on orientation
    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;

    // Orientation 1 (Normal), 3 (180), 6 (90 CW), 8 (90 CCW)
    // We simplify: if orientations are swap-capable, we swap w/h.
    const isSwapped = orientation >= 5;

    if (!isSwapped) {
        // Landscape-ish (1, 2, 3, 4)
        x = (nativeLeft / nativeWidth) * 100;
        y = (nativeTop / nativeHeight) * 100;
        w = (clap.width / nativeWidth) * 100;
        h = (clap.height / nativeHeight) * 100;

        if (orientation === 3) {
            // 180 flip
            x = 100 - x - w;
            y = 100 - y - h;
        }
    } else {
        // Portrait-ish (5, 6, 7, 8)
        // In user-space (after rotation), the "width" of the screen corresponds to native "height"
        // and "height" to native "width".
        if (orientation === 6) {
            // 90 CW: Visual X = (H - Native Y_end), Visual Y = Native X
            x = (nativeHeight - nativeTop - clap.height) / nativeHeight * 100;
            y = (nativeLeft / nativeWidth) * 100;
            w = (clap.height / nativeHeight) * 100;
            h = (clap.width / nativeWidth) * 100;
        } else if (orientation === 8) {
            // 90 CCW: Visual X = Native Y, Visual Y = (W - Native X_end)
            x = (nativeTop / nativeHeight) * 100;
            y = (nativeWidth - nativeLeft - clap.width) / nativeWidth * 100;
            w = (clap.height / nativeHeight) * 100;
            h = (clap.width / nativeWidth) * 100;
        } else {
            // Fallback for mirror modes (5, 7) - rare, just use central defaults
            x = (nativeLeft / nativeWidth) * 100;
            y = (nativeTop / nativeHeight) * 100;
            w = (clap.width / nativeWidth) * 100;
            h = (clap.height / nativeHeight) * 100;
        }
    }

    return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        width: Math.max(0, Math.min(100, w)),
        height: Math.max(0, Math.min(100, h))
    };
}

/**
 * Converts user-space crop (percentages) to native "clap" coordinates.
 */
export function userCropToNativeClap(
    crop: UserCrop,
    nativeWidth: number,
    nativeHeight: number,
    orientation: number
): CleanApertureData {
    const isSwapped = orientation >= 5;

    let nativeLeft = 0;
    let nativeTop = 0;
    let clapWidth = 0;
    let clapHeight = 0;

    if (!isSwapped) {
        clapWidth = (crop.width / 100) * nativeWidth;
        clapHeight = (crop.height / 100) * nativeHeight;
        nativeLeft = (crop.x / 100) * nativeWidth;
        nativeTop = (crop.y / 100) * nativeHeight;

        if (orientation === 3) {
            nativeLeft = nativeWidth - nativeLeft - clapWidth;
            nativeTop = nativeHeight - nativeTop - clapHeight;
        }
    } else {
        // User W -> Native H
        // User H -> Native W
        clapWidth = (crop.height / 100) * nativeWidth;
        clapHeight = (crop.width / 100) * nativeHeight;

        if (orientation === 6) {
            nativeLeft = (crop.y / 100) * nativeWidth;
            nativeTop = (100 - crop.x - crop.width) / 100 * nativeHeight;
        } else if (orientation === 8) {
            nativeLeft = (100 - crop.y - crop.height) / 100 * nativeWidth;
            nativeTop = (crop.x / 100) * nativeHeight;
        } else {
            nativeLeft = (crop.x / 100) * nativeWidth;
            nativeTop = (crop.y / 100) * nativeHeight;
        }
    }

    // Calculate center offsets
    const horizOffset = nativeLeft + clapWidth / 2 - nativeWidth / 2;
    const vertOffset = nativeTop + clapHeight / 2 - nativeHeight / 2;

    return {
        width: Math.round(clapWidth),
        height: Math.round(clapHeight),
        horizOffset: Math.round(horizOffset),
        vertOffset: Math.round(vertOffset),
    };
}

/**
 * Validates that current clap data is within native dimensions.
 */
export function validateClap(clap: CleanApertureData, nativeWidth: number, nativeHeight: number): { valid: boolean; reason?: string } {
    const left = (nativeWidth / 2) + clap.horizOffset - (clap.width / 2);
    const top = (nativeHeight / 2) + clap.vertOffset - (clap.height / 2);

    if (left < -0.5 || top < -0.5) return { valid: false, reason: "Crop starts outside bounds" };
    if (left + clap.width > nativeWidth + 0.5) return { valid: false, reason: "Crop exceeds width" };
    if (left + clap.height > nativeHeight + 0.5) return { valid: false, reason: "Crop exceeds height" };

    return { valid: true };
}


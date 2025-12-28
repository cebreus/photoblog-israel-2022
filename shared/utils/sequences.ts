/**
 * Shared utilities for detecting and working with image sequences.
 * Used by both build scripts and runtime application.
 *
 * Sequences are identified by filename suffixes like:
 * - --zoom1from3, --pan2from4, --burst1from5 (indexed sequences)
 * - --tl1from24 (timelapse)
 * - --focus1from3 (focus stack)
 * - --pano (single-file panorama)
 */

import type { SequenceInfo, SequenceType } from "../types/manifest";

/**
 * Master regex for all sequence types.
 * Matches:
 * - Indexed: --type[index]from[total] where type is zoom|pan|burst|tl|focus
 * - Single-file: --pano
 */
export const SEQUENCE_REGEX =
    /(?:--(?<type>zoom|pan|burst|tl|focus)(?<index>\d+)from(?<total>\d+))|(?:--(?<pano>pano))$/;

/**
 * Maps short suffix names to canonical SequenceType values.
 */
export const TYPE_MAP: Record<string, SequenceType> = {
    zoom: "zoom",
    pan: "pan",
    burst: "burst",
    tl: "timelapse",
    focus: "focus-stack",
    pano: "pano",
};

/**
 * Parse sequence suffix from image ID or filename.
 * @returns SequenceInfo if valid suffix found, null otherwise.
 *
 * @example
 * parseSequenceSuffix("2025-11-25-cebreus--zoom1from3")
 * // => { type: "zoom", index: 1, total: 3, baseId: "2025-11-25-cebreus" }
 *
 * parseSequenceSuffix("2025-11-26-cebreus--pano")
 * // => { type: "pano", index: 1, total: 1, baseId: "2025-11-26-cebreus" }
 */
export function parseSequenceSuffix(imageId: string): SequenceInfo | null {
    const match = imageId.match(SEQUENCE_REGEX);
    if (!match?.groups) return null;

    if (match.groups.pano) {
        return {
            type: "pano",
            index: 1,
            total: 1,
            baseId: imageId.replace(SEQUENCE_REGEX, ""),
        };
    }

    return {
        type: TYPE_MAP[match.groups.type] ?? "zoom",
        index: Number.parseInt(match.groups.index, 10),
        total: Number.parseInt(match.groups.total, 10),
        baseId: imageId.replace(SEQUENCE_REGEX, ""),
    };
}

/**
 * Check if image ID belongs to a sequence (any type).
 */
export function isSequenceMember(imageId: string): boolean {
    return SEQUENCE_REGEX.test(imageId);
}

/**
 * Check if image is the representative (last) member of a sequence.
 * Representative images are shown in the grid.
 * For single-file panoramas (index=1, total=1), always returns true.
 */
export function isRepresentative(imageId: string): boolean {
    const info = parseSequenceSuffix(imageId);
    return info !== null && info.index === info.total;
}

/**
 * Check if an image ID represents a panorama.
 */
export function isPanorama(imageId: string): boolean {
    const info = parseSequenceSuffix(imageId);
    return info?.type === "pano";
}

/**
 * Helper to compare two images by their sequence index.
 */
function compareByIndex<T extends { id: string }>(a: T, b: T): number {
    const infoA = parseSequenceSuffix(a.id);
    const infoB = parseSequenceSuffix(b.id);
    return (infoA?.index ?? 0) - (infoB?.index ?? 0);
}

/**
 * Get all members of a sequence by baseId, sorted by index.
 */
export function getSequenceMembers<T extends { id: string }>(
    images: T[],
    baseId: string,
): T[] {
    const members: T[] = [];

    for (const img of images) {
        const info = parseSequenceSuffix(img.id);
        if (info?.baseId === baseId) {
            members.push(img);
        }
    }

    return members.sort(compareByIndex);
}

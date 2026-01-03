import type { ImageEntry } from "../types/manifest";
import { toPureWallClockISO } from "./dates";

/**
 * Calculates ReleaseDates for a list of images based on their desired order.
 * Uses "Time Slot Swapping" strategy to preserve absolute time boundaries.
 * 
 * @param imageIds - The desired order of image IDs
 * @param currentItems - The pool of available ImageEntries (source of timestamps)
 * @returns A map of imageId -> new ISO timestamp
 */
export function calculateReleaseDates(
    imageIds: string[],
    currentItems: ImageEntry[],
): Record<string, string> {
    const result: Record<string, string> = {};

    // STRATEGY: Time Slot Swapping (Rank-Order Preservation)
    // Instead of interpolating new times (which can shift boundaries), we collect
    // all existing timestamps from the affected images, sort them, and re-assign
    // them to the images in their new order.
    //
    // This guarantees:
    // 1. The Day Start (Min Time) is preserved.
    // 2. The Day End (Max Time) is preserved.
    // 3. Any internal gaps (e.g. travel time between locations) are preserved as "slots".
    // 4. No timestamps ever drift outside the original range.

    // 1. Filter relevant items (only those involved in reordering)
    const relevantItemsMap = new Map<string, ImageEntry>();
    const timestamps: number[] = [];

    for (const item of currentItems) {
        if (imageIds.includes(item.id)) {
            relevantItemsMap.set(item.id, item);
            const timeStr = item.exif?.releaseDate || item.exif?.date;
            if (timeStr) {
                timestamps.push(new Date(timeStr).getTime());
            }
        }
    }

    // 2. Sort available timestamps to create ordered "slots"
    timestamps.sort((a, b) => a - b);

    // 3. Assign sorted timestamps to the new image order
    imageIds.forEach((id, index) => {
        const item = relevantItemsMap.get(id);
        if (!item) return;

        // Safety check: ensure we have a slot for this image
        if (index < timestamps.length) {
            let newTimeMs = timestamps[index];

            // NUDGE LOGIC: If we are at the very beginning or end, and the order changed,
            // we might need to nudge the time by 1s to allow moving "past" a separator 
            // that shares the same boundary timestamp.
            if (index === 0 && imageIds[0] !== currentItems[0]?.id) {
                // Moving something to the very start -> nudge 1s earlier
                newTimeMs -= 1000;
            } else if (index === imageIds.length - 1 && imageIds[imageIds.length - 1] !== currentItems[currentItems.length - 1]?.id) {
                // Moving something to the very end -> nudge 1s later
                newTimeMs += 1000;
            }

            // USE UTC components to create a Date that toPureWallClockISO can format without shifting
            const d = new Date(newTimeMs);
            const newTimeStr = toPureWallClockISO(d)!;

            const oldTimeStr = item.exif?.releaseDate || item.exif?.date;

            // Only update if time actually changed (avoids unnecessary writes)
            if (oldTimeStr !== newTimeStr) {
                result[id] = newTimeStr;
            }
        }
    });

    return result;
}

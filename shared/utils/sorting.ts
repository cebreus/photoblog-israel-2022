import type { ImageEntry } from "../types/manifest";
import { addSecondsToIsoString, diffIsoStringsInSeconds } from "./dates";

/**
 * Calculates ReleaseDates for a list of images based on their desired order.
 * Uses "Time Slot Swapping" strategy to preserve absolute time boundaries.
 * All date operations use pure string manipulation to avoid timezone issues.
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
    const timestamps: string[] = [];

    for (const item of currentItems) {
        if (imageIds.includes(item.id)) {
            relevantItemsMap.set(item.id, item);
            const timeStr = item.exif?.releaseDate || item.exif?.date;
            if (timeStr) {
                timestamps.push(timeStr);
            }
        }
    }

    // 2. Sort available timestamps to create ordered "slots" (ISO strings sort correctly)
    timestamps.sort();

    // 3. Assign sorted timestamps to the new image order
    imageIds.forEach((id, index) => {
        const item = relevantItemsMap.get(id);
        if (!item) return;

        // Safety check: ensure we have a slot for this image
        if (index < timestamps.length) {
            let newTimeStr = timestamps[index];

            // NUDGE LOGIC: If we are at the very beginning or end, and the order changed,
            // we might need to nudge the time by 1s to allow moving "past" a separator 
            // that shares the same boundary timestamp.
            if (index === 0 && imageIds[0] !== currentItems[0]?.id) {
                // Moving something to the very start -> nudge 1s earlier
                newTimeStr = addSecondsToIsoString(newTimeStr, -1) || newTimeStr;
            } else if (index === imageIds.length - 1 && imageIds[imageIds.length - 1] !== currentItems[currentItems.length - 1]?.id) {
                // Moving something to the very end -> nudge 1s later
                newTimeStr = addSecondsToIsoString(newTimeStr, 1) || newTimeStr;
            }

            const oldTimeStr = item.exif?.releaseDate || item.exif?.date;

            // Only update if time actually changed (avoids unnecessary writes)
            if (oldTimeStr !== newTimeStr) {
                result[id] = newTimeStr;
            }
        }
    });

    return result;
}

/**
 * Distributes images evenly across a time range while respecting sequence groupings.
 * Grouped images (sequences) are treated as a single block of time.
 * Internal relative offsets within a sequence are preserved from their original capture dates.
 * 
 * Uses pure string-based date arithmetic to avoid timezone issues.
 *
 * @param items - Ordered list of ImageEntries to distribute
 * @param startTime - Start of the time range (ISO string)
 * @param endTime - End of the time range (ISO string)
 * @returns Map of imageId -> new ISO timestamp
 */
export function distributeTimesInRange(
    items: ImageEntry[],
    startTime: string,
    endTime: string,
): Record<string, string> {
    const result: Record<string, string> = {};

    if (items.length === 0) return result;

    // 1. Calculate total range in seconds (string-based)
    const totalRangeSeconds = diffIsoStringsInSeconds(startTime, endTime);

    if (totalRangeSeconds <= 0) {
        console.warn(`Invalid time range: ${startTime} to ${endTime}`);
        return result;
    }

    // 2. Identify Groups (Blocks)
    type TimeBlock = {
        items: ImageEntry[];
        durationSeconds: number;
        originalStartTime: string;
    };

    const blocks: TimeBlock[] = [];
    let currentBlock: TimeBlock | null = null;

    for (const item of items) {
        const itemDate = item.exif?.date || "";

        // Determine if this item continues the previous sequence
        const isSequenceContinuation =
            currentBlock &&
            currentBlock.items.length > 0 &&
            item.sequenceInfo &&
            currentBlock.items[0].sequenceInfo &&
            item.sequenceInfo.baseId === currentBlock.items[0].sequenceInfo.baseId;

        if (isSequenceContinuation && currentBlock) {
            currentBlock.items.push(item);
            // Update duration using string diff
            if (itemDate && currentBlock.originalStartTime) {
                currentBlock.durationSeconds = diffIsoStringsInSeconds(currentBlock.originalStartTime, itemDate);
            }
        } else {
            // Finalize previous block
            if (currentBlock) {
                blocks.push(currentBlock);
            }
            // Start new block
            currentBlock = {
                items: [item],
                durationSeconds: 0,
                originalStartTime: itemDate,
            };
        }
    }
    // Push the last block
    if (currentBlock) {
        blocks.push(currentBlock);
    }

    // 3. Calculate Gaps
    const totalContentDurationSeconds = blocks.reduce((sum, b) => sum + b.durationSeconds, 0);
    const availableGapSpaceSeconds = totalRangeSeconds - totalContentDurationSeconds;
    const gapSizeSeconds = Math.max(0, Math.floor(availableGapSpaceSeconds / (blocks.length + 1)));

    // 4. Assign Times (string-based cursor)
    let currentCursorTime = addSecondsToIsoString(startTime, gapSizeSeconds) || startTime;

    for (const block of blocks) {
        const blockStartTime = currentCursorTime;

        block.items.forEach((item, index) => {
            let itemTime: string;

            if (index === 0) {
                // First item in block starts at cursor
                itemTime = blockStartTime;
            } else {
                // Subsequent items maintain their relative offset from the first item
                const itemOriginalDate = item.exif?.date || "";
                if (itemOriginalDate && block.originalStartTime) {
                    const offsetSeconds = diffIsoStringsInSeconds(block.originalStartTime, itemOriginalDate);
                    itemTime = addSecondsToIsoString(blockStartTime, Math.max(0, offsetSeconds)) || blockStartTime;
                } else {
                    itemTime = blockStartTime;
                }
            }

            // Safety clamp: ensure we don't exceed end time
            if (diffIsoStringsInSeconds(itemTime, endTime) < 0) {
                itemTime = endTime;
            }

            result[item.id] = itemTime;
        });

        // Move cursor past this block + gap
        currentCursorTime = addSecondsToIsoString(currentCursorTime, block.durationSeconds + gapSizeSeconds) || currentCursorTime;
    }

    return result;
}


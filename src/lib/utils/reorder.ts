import { invalidateAll } from "$app/navigation";
import { createLogger } from "$lib/logger";

const logger = createLogger("reorder-utils");

/**
 * Payload for the reorder API.
 */
export type ReorderPayload = {
  dayId: string;
  imageIds: string[];
  contentDir?: string;
};

/**
 * Saves the new order of images within a day to the backend.
 * Updates both sortorder.manifest.json (persistent) and images.manifest.json (immediate effect).
 */
export async function saveImageOrder(
  payload: ReorderPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/images/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = data.message || "Failed to save order";
      logger.error(`Reorder API error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const result = await response.json();
    logger.info(`Saved order for ${result.updated} images in ${payload.dayId}`);

    // Refresh page data to reflect new order
    await invalidateAll();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to save image order: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Clears manual sort order for a day, reverting to EXIF date ordering.
 */
export async function clearImageOrder(
  dayId: string,
  contentDir?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/images/reorder", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayId, contentDir }),
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = data.message || "Failed to clear order";
      logger.error(`Clear order API error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const result = await response.json();
    logger.info(`Cleared order for ${result.cleared} images in ${dayId}`);

    await invalidateAll();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to clear image order: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Reorders an array by moving an item from one index to another.
 * Returns a new array, does not mutate the original.
 */
export function reorderArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

import { invalidateAll } from "$app/navigation";
import { createLogger } from "$lib/logger";
import { tracedFetch } from "$lib/utils/api";

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
    const response = await tracedFetch("/api/images/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = data.message || "Failed to save order";
      logger.error({ status: response.status, error: errorMsg }, "Reorder API error");
      return { success: false, error: errorMsg };
    }

    const result = await response.json();
    logger.info({ updatedCount: result.updated, dayId: payload.dayId }, "Saved order for images");

    // Refresh page data to reflect new order
    await invalidateAll();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to save image order");
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
    const response = await tracedFetch("/api/images/reorder", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayId, contentDir }),
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMsg = data.message || "Failed to clear order";
      logger.error({ status: response.status, error: errorMsg }, "Clear order API error");
      return { success: false, error: errorMsg };
    }

    const result = await response.json();
    logger.info({ clearedCount: result.cleared, dayId }, "Cleared order for images");

    await invalidateAll();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to clear image order");
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

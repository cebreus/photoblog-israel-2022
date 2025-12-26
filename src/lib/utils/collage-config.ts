import { log } from "$lib/logger";
import type { CollageRequest } from "$lib/types/collage";

/**
 * Load collage configuration from a sidecar JSON file.
 * Returns null if file doesn't exist or can't be parsed.
 */
export async function loadCollageConfig(collageImageId: string): Promise<CollageRequest | null> {
  // Ensure we have .json extension, removing potential image extension first
  const base = collageImageId.replace(/\.(jpe?g|webp|png)$/i, "");

  // Try both single and double hyphen variants (slugification can collapse them)
  const variants = [base];
  if (base.endsWith("-collage") && !base.endsWith("--collage")) {
    variants.push(base.replace("-collage", "--collage"));
  } else if (base.endsWith("--collage")) {
    variants.push(base.replace("--collage", "-collage"));
  }

  const candidatePaths: string[] = [];
  for (const v of variants) {
    const jsonPath = `${v}.json`;
    candidatePaths.push(jsonPath);
    candidatePaths.push(`pics/${jsonPath}`);
  }

  for (const path of candidatePaths) {
    try {
      const response = await fetch(`/api/files/${path}`);
      if (response.ok) {
        const config = (await response.json()) as CollageRequest;
        return config;
      }
    } catch (_e) {
      // Silently try next path
    }
  }

  log.error(`Nepodařilo se načíst konfiguraci koláže (zkoušeno: ${candidatePaths.join(", ")})`);
  return null;
}

/**
 * Check if an imageId represents a collage (has --collage suffix).
 * Supports both full filenames and slugified IDs.
 */
export function isCollage(imageId: string): boolean {
  // Matches both --collage (preferred) and -collage (slugified/legacy)
  return /--collage(\.jpe?g)?$/i.test(imageId) || /-collage(\.jpe?g)?$/i.test(imageId);
}

/**
 * Get source image IDs from a collage config, resolving to moved paths.
 */
export function getCollageSourceIds(config: CollageRequest): string[] {
  return config.items.map((item) => {
    const rawId = item.movedPath || item.originalPath || item.imageId;
    // Strip directory and common image extensions to match manifest IDs (slugs)
    const filename = rawId.split("/").pop() || rawId;
    return filename.replace(/\.(jpe?g|webp|png|heic|avif)$/i, "");
  });
}

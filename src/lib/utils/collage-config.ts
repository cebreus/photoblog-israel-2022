import { log } from "$lib/logger";
import type { CollageRequest } from "$lib/types/collage";
import type { ImageEntry } from "$lib/types/manifest";

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
    // JSON is always in pics/ directory
    const jsonFilename = `${v}.json`;
    candidatePaths.push(`pics/${jsonFilename}`);
  }

  for (const path of candidatePaths) {
    try {
      const response = await fetch(`/api/files/${path}?t=${Date.now()}`);
      if (response.ok) {
        const rawConfig = await response.json();

        if (isValidCollageConfig(rawConfig)) {
          return rawConfig;
        }
        log.warn({ path }, "Invalid collage config format");
      }
    } catch (_e) {
      // Silently try next path
    }
  }

  log.error({ paths: candidatePaths }, "Collage config not found");
  return null;
}

function isValidCollageConfig(data: unknown): data is CollageRequest {
  if (!data || typeof data !== "object") return false;
  const c = data as Partial<CollageRequest>;

  if (!Array.isArray(c.items) || c.items.length < 2) return false;
  if (!c.template || typeof c.template !== "string") return false;

  for (const item of c.items) {
    if (!item || typeof item !== "object") return false;
    const i = item as { imageId?: unknown };
    if (typeof i.imageId !== "string") return false;
  }

  return true;
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

/**
 * Create placeholder ImageEntry objects for collage source images
 * that have been moved to collage-sources/ and removed from manifest.
 * Fetches real dimensions from the API endpoint.
 */
export async function createSourceImagePlaceholders(
  config: CollageRequest,
  _urlPrefix: string,
): Promise<ImageEntry[]> {
  const ids = config.items.map((item) => item.id).filter(Boolean);

  // Fetch real metadata from API
  let sourcesMetadata: Record<string, { width: number; height: number }> = {};

  try {
    const response = await fetch(`/api/collage-sources?ids=${ids.join(",")}`);
    if (response.ok) {
      const data = await response.json();
      sourcesMetadata = Object.fromEntries(
        data.sources.map((s: { id: string; width: number; height: number }) => [
          s.id,
          { width: s.width, height: s.height },
        ]),
      );
    } else {
      log.warn({}, "Failed to fetch collage source metadata, using fallback dimensions");
    }
  } catch (error) {
    log.error({ err: error }, "Error fetching collage source metadata");
  }

  log.info({ count: config.items.length }, "[CollageConfig] Creating placeholders");
  return config.items.map((item) => {
    const id = item.id || "unknown";
    const filename = item.imageId || `${id}.jpg`;
    const meta = sourcesMetadata[id] || { width: 1000, height: 1000 };

    // Use development file API to serve original images from collage-sources
    const sourceUrl = `/api/files/pics/collage-sources/${filename}`;
    log.info(
      `[CollageConfig] Item ${id}: filename=${filename}, url=${sourceUrl}, meta=${meta.width}x${meta.height}`,
    );

    return {
      id,
      type: "image" as const,
      src: filename,
      width: meta.width,
      height: meta.height,
      sources: [
        {
          path: sourceUrl,
          type: "image/jpeg",
        },
      ],
      adminThumbUrl: sourceUrl,
    } as ImageEntry;
  });
}

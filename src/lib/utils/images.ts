import type {
  Manifest,
  PhotoDay,
  ImageEntry,
  ImageSource,
  CurationManifest,
} from "../types/manifest";
import manifest from "$manifests/images.manifest.json" with { type: "json" };
// @ts-ignore
import curationManifest from "$manifests/curation.manifest.json" with { type: "json" };

// Helper to validate/cast the manifest safely
function isManifest(acc: unknown): acc is Manifest {
  return typeof acc === "object" && acc !== null && "photoDays" in acc;
}

const typedManifest: Manifest = isManifest(manifest) ? manifest : { photoDays: [] };

export function getManifest(): Manifest {
  return typedManifest;
}

export function getPhotoDays(): PhotoDay[] {
  return typedManifest.photoDays ?? [];
}

export function getCurationManifest(): CurationManifest {
  return curationManifest as unknown as CurationManifest;
}

/**
 * Gathers all available image sources from all variants and groups them by type.
 * This creates a comprehensive srcset for each image format, enabling full resolution switching.
 * @param item The image entry from the manifest.
 * @returns An array of source objects for the <picture> element.
 */
export function getSources(item: ImageEntry) {
  const sourcesByType: { [type: string]: string[] } = {};

  // Group all available sizes by image type (e.g., 'image/webp') from the flat sources array
  for (const source of item.sources) {
    if (!sourcesByType[source.type]) {
      sourcesByType[source.type] = [];
    }
    // Create a srcset entry with the path and width descriptor
    sourcesByType[source.type].push(`${source.path} ${source.width}w`);
  }

  // Create the final array for the <picture> element, ordered by preference
  const result = Object.entries(sourcesByType)
    .map(([type, srcsetParts]) => {
      return {
        type: type,
        srcset: srcsetParts.join(", "),
      };
    })
    .sort((a, b) => {
      // Prefer AVIF > WebP > JPEG
      if (a.type.includes("avif")) return -1;
      if (b.type.includes("avif")) return 1;
      if (a.type.includes("webp")) return -1;
      if (b.type.includes("webp")) return 1;
      return 0;
    });

  return result;
}

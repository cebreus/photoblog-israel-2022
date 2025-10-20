import type { Manifest, ImageEntry } from '../types';
import manifest from '$lib/images.manifest.json';

const typedManifest = manifest as unknown as Manifest;

export function getManifest() {
  return typedManifest;
}

export function getPhotoDays() {
  return typedManifest.photoDays || [];
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
        srcset: srcsetParts.join(', '),
      };
    })
    .sort((a, b) => {
      // Prefer AVIF > WebP > JPEG
      if (a.type.includes('avif')) return -1;
      if (b.type.includes('avif')) return 1;
      if (a.type.includes('webp')) return -1;
      if (b.type.includes('webp')) return 1;
      return 0;
    });

  return result;
}



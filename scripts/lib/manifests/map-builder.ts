/**
 * @fileoverview Generates optimized map.manifest.json for the /map route.
 *
 * @description
 * Creates a minimal manifest containing only GPS coordinates, location names,
 * and thumbnail paths for efficient map rendering.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { saveManifest } from "$scripts/manifests/repository";
import type { ImageEntry, ImageSource, Manifest, PhotoDay } from "$shared/types/manifest";
import { isImageEntry } from "$shared/types/manifest";
import type { MapImage, MapLocation, MapManifest } from "$shared/types/map";
import path from "node:path";

const logger = createLogger("map-manifest");

/**
 * Checks if an image source is a fallback variant
 */
function isFallbackVariant(source: ImageSource): boolean {
  return source.variant === "fallback";
}

/**
 * Checks if an image source is a detail variant
 */
function isDetailVariant(source: ImageSource): boolean {
  return source.variant === "detail";
}

/**
 * Groups images by their location.
 * Only includes entries with valid GPS coordinates.
 */
function groupImagesByLocation(photoDays: PhotoDay[]): Map<string, ImageEntry[]> {
  const locationMap = new Map<string, ImageEntry[]>();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item)) {
        continue;
      }

      const entry = item;
      const latitude = entry.exif?.latitude;
      const longitude = entry.exif?.longitude;

      if (latitude === undefined || longitude === undefined) {
        continue;
      }

      // Prioritize explicit location name, fallback to rounded coordinates
      const locationKey = entry.exif?.location || `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, []);
      }

      const group = locationMap.get(locationKey);
      if (group) {
        group.push(entry);
      }
    }
  }

  return locationMap;
}

/**
 * Generates the optimized map manifest from the full images manifest.
 */
export function generateMapManifest(manifest: Manifest): MapManifest {
  const locationGroups = groupImagesByLocation(manifest.photoDays);
  const locations: MapLocation[] = [];

  logger.info({ locationCount: locationGroups.size }, "Processing locations for map");

  for (const [locationKey, images] of locationGroups) {
    const firstImage = images[0];
    const latitude = firstImage.exif?.latitude;
    const longitude = firstImage.exif?.longitude;

    if (latitude === undefined || longitude === undefined) {
      logger.warn({ id: firstImage.id }, "Skipping image with missing coordinates");
      continue;
    }

    const thumbnail = firstImage.sources.find(isFallbackVariant) || firstImage.sources[0];

    const mapImages: MapImage[] = [];
    for (const img of images) {
      const detailSource = img.sources.find(isDetailVariant) || img.sources[0];
      const thumbSource = img.sources.find(isFallbackVariant) || img.sources[0];

      mapImages.push({
        id: img.id,
        alt: img.alt,
        detail: detailSource.path,
        thumb: thumbSource.path,
      });
    }

    locations.push({
      id: locationKey,
      lat: latitude,
      lng: longitude,
      name: firstImage.exif?.location || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      count: images.length,
      thumbnail: thumbnail.path,
      images: mapImages,
    });
  }

  logger.info(
    {
      totalImages: manifest.photoDays.flatMap((d) => d.items.filter(isImageEntry)).length,
      locationsWithGPS: locations.length,
    },
    "Map manifest statistics",
  );

  return {
    meta: {
      version: 1,
      generatedAt: new Date().toISOString(),
      generator: "map-manifest-builder",
    },
    locations,
  };
}

/**
 * Writes the map manifest to disk.
 */
export async function writeMapManifest(
  mapManifest: MapManifest,
  outputPath: string,
): Promise<void> {
  await saveManifest(outputPath, mapManifest);
  logger.info({ path: outputPath }, "Map manifest written successfully");
}

/**
 * Generates and writes the map manifest.
 */
export async function buildAndWriteMapManifest(manifest: Manifest, dataDir: string): Promise<void> {
  const mapManifest = generateMapManifest(manifest);
  const outputPath = path.join(dataDir, "map.manifest.json");
  await writeMapManifest(mapManifest, outputPath);
}

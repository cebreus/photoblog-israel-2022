/**
 * @fileoverview Generates optimized map.manifest.json for the /map route.
 *
 * @description
 * Creates a minimal manifest containing only GPS coordinates, location names,
 * and thumbnail paths for efficient map rendering.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { saveManifest } from "$scripts/manifests/repository";
import type {
  ImageEntry,
  ImageSource,
  Manifest,
  MenuManifest,
  PhotoDay,
} from "$shared/types/manifest";
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
 * @param manifest - The full images manifest
 * @param menuManifest - The menu manifest for bidirectional linking
 */
export function generateMapManifest(manifest: Manifest, menuManifest?: MenuManifest): MapManifest {
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

    //🆕 Bidirectional linking: find matching MenuLocations and extract days
    const menuLocationIds: string[] = [];
    const daysSet = new Set<string>();

    // Collect days from images
    for (const img of images) {
      // Find the day this image belongs to
      for (const day of manifest.photoDays) {
        if (day.items.some((item) => item.id === img.id)) {
          daysSet.add(day.date);
          break;
        }
      }
    }

    // If menuManifest provided, find matching MenuLocations
    if (menuManifest) {
      for (const day of Array.from(daysSet)) {
        const menuDay = menuManifest.find((md) => md.date === day);
        if (menuDay) {
          for (const menuLoc of menuDay.locations) {
            // Match by mapLocationId (which should equal our locationKey)
            if (menuLoc.mapLocationId === locationKey) {
              menuLocationIds.push(menuLoc.id);
            }
          }
        }
      }
    }

    locations.push({
      id: locationKey,
      lat: latitude,
      lng: longitude,
      name: firstImage.exif?.location || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      count: images.length,
      thumbnail: thumbnail.path,
      images: mapImages,
      // 🆕 Bidirectional linking data
      menuLocationIds: menuLocationIds.length > 0 ? menuLocationIds : undefined,
      days: daysSet.size > 0 ? Array.from(daysSet).sort() : undefined,
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
 * @param manifest - The full images manifest
 * @param menuManifest - The menu manifest for bidirectional linking
 * @param dataDir - Output directory path
 */
export async function buildAndWriteMapManifest(
  manifest: Manifest,
  menuManifest: MenuManifest | undefined,
  dataDir: string,
): Promise<void> {
  const mapManifest = generateMapManifest(manifest, menuManifest);
  const outputPath = path.join(dataDir, "map.manifest.json");
  await writeMapManifest(mapManifest, outputPath);
}

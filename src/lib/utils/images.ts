import path from "node:path";
import { building, dev } from "$app/environment";
import curationManifest from "$manifests/curation.manifest.json" with { type: "json" };
import manifest from "$manifests/images.manifest.json" with { type: "json" };
import peopleManifestImport from "$manifests/people.manifest.json" with { type: "json" };
import type {
  CurationManifest,
  ImageEntry,
  Manifest,
  PeopleManifest,
  PhotoDay,
} from "../types/manifest";
import {
  isValidCurationManifest,
  isValidManifest,
  isValidPeopleManifest,
} from "./manifest-validators";

// Mutable manifests for dev-mode reloading
let currentManifest: Manifest = isValidManifest(manifest) ? manifest : { photoDays: [] };
let currentPeopleManifest: PeopleManifest = isValidPeopleManifest(peopleManifestImport)
  ? peopleManifestImport
  : { people: [] };
let currentCurationManifest: CurationManifest = isValidCurationManifest(curationManifest)
  ? curationManifest
  : { groups: [], stats: { totalPhotos: 0, totalGroups: 0, duplicatesFound: 0 } };

/**
 * In DEV mode on the server, reload manifests from disk to bypass Vite caching.
 * This ensures that API updates are immediately reflected in the UI.
 */
export async function reloadManifests() {
  if (dev && !building && typeof process !== "undefined") {
    try {
      // Use process.cwd() to find project root
      const contentDir = process.env.CONTENT_DIR || "egypt-2025"; // Fallback to egypt if not set
      const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

      const fsp = await import("node:fs/promises");

      // Reload Images Manifest
      try {
        const raw = await fsp.readFile(path.join(dataDir, "images.manifest.json"), "utf-8");
        const json = JSON.parse(raw);
        if (isValidManifest(json)) {
          currentManifest = json;
          allImagesMap = null; // Clear cache
          imagePeopleMap = null; // Clear cache
        }
      } catch (e) {
        console.warn("[images] Failed to reload images.manifest:", e);
      }

      // Reload People Manifest
      try {
        const raw = await fsp.readFile(path.join(dataDir, "people.manifest.json"), "utf-8");
        const json = JSON.parse(raw);
        if (isValidPeopleManifest(json)) {
          currentPeopleManifest = json;
        }
      } catch (e) {
        console.warn("[images] Failed to reload people.manifest:", e);
      }

      // Reload Curation Manifest
      try {
        const raw = await fsp.readFile(path.join(dataDir, "curation.manifest.json"), "utf-8");
        const json = JSON.parse(raw);
        if (isValidCurationManifest(json)) {
          currentCurationManifest = json;
        }
      } catch (_e) {
        // Curation manifest might not exist
      }
    } catch (e) {
      console.error("[images] Failed to reload manifests:", e);
    }
  }
}

export function getManifest(): Manifest {
  return currentManifest;
}

export function getPhotoDays(): PhotoDay[] {
  return currentManifest.photoDays ?? [];
}

let imagePeopleMap: Record<string, string[]> | null = null;

export function getImagePeopleMap(): Record<string, string[]> {
  if (!dev && imagePeopleMap) return imagePeopleMap;

  imagePeopleMap = {};
  const photoDays = getPhotoDays();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.people && item.people.length > 0) {
        imagePeopleMap[item.id] = item.people;
      }
    }
  }

  return imagePeopleMap;
}

let allImagesMap: Map<string, ImageEntry> | null = null;

export function getImageById(id: string): ImageEntry | undefined {
  if (!allImagesMap) {
    allImagesMap = new Map();
    const photoDays = getPhotoDays();
    for (const day of photoDays) {
      for (const item of day.items) {
        if (item.type === "image") {
          allImagesMap.set(item.id, item);
        }
      }
    }
  }
  return allImagesMap.get(id);
}

export function getCurationManifest(): CurationManifest {
  return currentCurationManifest;
}

export function getPeopleManifest(): PeopleManifest {
  return currentPeopleManifest;
}

interface SourceEntry {
  type: string;
  srcset: string;
}

function createSourceEntry([type, srcsetParts]: [string, string[]]): SourceEntry {
  return {
    type,
    srcset: srcsetParts.join(", "),
  };
}

function getImageFormatPriority(type: string): number {
  if (type.includes("avif")) return 1;
  if (type.includes("webp")) return 2;
  return 3;
}

function compareByFormatPreference(a: SourceEntry, b: SourceEntry): number {
  return getImageFormatPriority(a.type) - getImageFormatPriority(b.type);
}

export function getSources(item: ImageEntry): SourceEntry[] {
  const sourcesByType: { [type: string]: string[] } = {};

  for (const source of item.sources) {
    if (!sourcesByType[source.type]) {
      sourcesByType[source.type] = [];
    }
    sourcesByType[source.type].push(`${source.path} ${source.width}w`);
  }

  return Object.entries(sourcesByType).map(createSourceEntry).sort(compareByFormatPreference);
}

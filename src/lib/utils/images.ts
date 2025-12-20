import { dev } from "$app/environment";
import curationManifest from "$manifests/curation.manifest.json" with { type: "json" };
import manifest from "$manifests/images.manifest.json" with { type: "json" };
import peopleManifest from "$manifests/people.manifest.json" with { type: "json" };
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

const typedManifest: Manifest = isValidManifest(manifest) ? manifest : { photoDays: [] };

export function getManifest(): Manifest {
  return typedManifest;
}

export function getPhotoDays(): PhotoDay[] {
  return typedManifest.photoDays ?? [];
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
  return isValidCurationManifest(curationManifest)
    ? curationManifest
    : {
        groups: [],
        stats: { totalPhotos: 0, totalGroups: 0, duplicatesFound: 0 },
      };
}

export function getPeopleManifest(): PeopleManifest {
  return isValidPeopleManifest(peopleManifest) ? peopleManifest : { people: [] };
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

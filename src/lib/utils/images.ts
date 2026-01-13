import { dev } from "$app/environment";
import { isCollage } from "$shared/utils/strings";
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

// Use glob imports to handle missing optional manifests gracefully
const curationGlob = import.meta.glob("$manifests/curation.manifest.json", {
  eager: true,
  import: "default",
});
const curationManifest = Object.values(curationGlob)[0] as CurationManifest | undefined;

const maxResolutionGlob = import.meta.glob("$manifests/images.manifest.json", {
  eager: true,
  import: "default",
});
const manifest = Object.values(maxResolutionGlob)[0] as Manifest | undefined;

const peopleGlob = import.meta.glob("$manifests/people.manifest.json", {
  eager: true,
  import: "default",
});
// Renamed to avoid confusion with type
const peopleManifestData = Object.values(peopleGlob)[0] as PeopleManifest | undefined;

/** Re-classify collages that were incorrectly typed as "image" */
export function reclassifyCollages(m: Manifest): Manifest {
  // Clone to avoid mutating frozen/immutable imported JSON
  const cloned = structuredClone(m);
  for (const day of cloned.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && isCollage(item.id)) {
        item.type = "collage";
      }
    }
  }
  return cloned;
}

/** Re-classify panoramas that were incorrectly typed as "image" */
export function reclassifyPanoramas(m: Manifest): Manifest {
  const cloned = structuredClone(m);
  for (const day of cloned.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.aspectRatio === "panorama") {
        item.type = "panorama";
      }
    }
  }
  return cloned;
}

/** Re-classify sequences/panoramas that were incorrectly typed as "image" */
export function reclassifySequences(m: Manifest): Manifest {
  const cloned = structuredClone(m);
  for (const day of cloned.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.sequenceInfo) {
        if (item.sequenceInfo.type === "pano") {
          item.type = "panorama";
        } else if (item.sequenceInfo.index === item.sequenceInfo.total) {
          // Representative item (last in sequence) becomes the playable "sequence"
          item.type = "sequence";
        } else {
          // Other items are just members
          item.type = "sequence-member";
        }
      }
    }
  }
  return cloned;
}

/** Normalizes people manifest data by ensuring isUserNamed is set */
export function normalizePeople(m: PeopleManifest): PeopleManifest {
  const cloned = structuredClone(m);
  if (cloned?.people) {
    for (const person of cloned.people) {
      if (person.isUserNamed === undefined) {
        person.isUserNamed = !person.id.startsWith("person-") || person.id.includes("--");
      }
    }
  }
  return cloned;
}

// Mutable manifests for dev-mode reloading
let lastManifestUpdate = Date.now();
let currentManifest: Manifest = reclassifySequences(
  reclassifyPanoramas(reclassifyCollages(isValidManifest(manifest) ? manifest : { photoDays: [] })),
);
let currentPeopleManifest: PeopleManifest = isValidPeopleManifest(peopleManifestData)
  ? normalizePeople(peopleManifestData)
  : { people: [] };
let currentCurationManifest: CurationManifest = isValidCurationManifest(curationManifest)
  ? curationManifest
  : { groups: [], stats: { totalPhotos: 0, totalGroups: 0, duplicatesFound: 0 } };

/**
 * Helper to atomic update manifest and clear caches
 */
export function updateManifests(
  newManifest: Manifest | null,
  newPeople: PeopleManifest | null,
  newCuration: CurationManifest | null,
) {
  lastManifestUpdate = Date.now();
  // 1. Update Manifests
  if (newManifest) currentManifest = newManifest;
  if (newPeople) currentPeopleManifest = newPeople;
  if (newCuration) currentCurationManifest = newCuration;

  // 2. Clear Caches (Force rebuild on next access)
  // We clear caches AFTER updating manifest to ensure next read gets fresh data derived from new manifest
  if (newManifest) {
    allImagesMap = null;
    imagePeopleMap = null;
  }
}

export function getManifest(): Manifest {
  return currentManifest;
}

export function getPhotoDays(): PhotoDay[] {
  return currentManifest.photoDays ?? [];
}

export function getManifestSignature(): string {
  const m = getManifest();
  const p = getPeopleManifest();

  // Prefer explicit version from metadata
  if (m.meta?.version && p.meta?.version) {
    return `v2-${m.meta.version}-${p.meta.version}-${lastManifestUpdate}`;
  }

  // Fallback signature based on lengths and content
  return `v1-${m.photoDays.length}-${p.people.length}-${m?.photoDays?.[0]?.items?.[0]?.id || "empty"}-${lastManifestUpdate}`;
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

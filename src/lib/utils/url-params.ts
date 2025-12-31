/**
 * @fileoverview URL Parameter Utilities
 *
 * Pure functions for parsing and building URL parameters.
 * Extracted from urlSync.svelte.ts for testability.
 */

import { MEDIA_TYPES } from "$lib/stores/filters.svelte";
import type { Author, MediaItemType, QualityBucket } from "$lib/types/manifest";
import { QUALITY_BUCKETS } from "$lib/utils/gallery";
import { toSlug } from "$lib/utils/strings";

// ---------------------------------------------------------------------------
// Token Encoding/Decoding
// ---------------------------------------------------------------------------

export function decodeToken(s: string): string {
  return decodeURIComponent(s.trim());
}

export function encodeToken(s: string): string {
  return encodeURIComponent(s);
}

// ---------------------------------------------------------------------------
// Boolean Parameter Helpers
// ---------------------------------------------------------------------------

export function parseBooleanParam(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export function syncBooleanParam(
  params: URLSearchParams,
  key: string,
  value: boolean,
  type: "presence" | "inverted-presence",
): void {
  params.delete(key);
  if (type === "presence" && value === true) {
    params.set(key, "");
  } else if (type === "inverted-presence" && value === false) {
    params.set(key, "");
  }
}

// ---------------------------------------------------------------------------
// Author Parameter Parsing
// ---------------------------------------------------------------------------

function getSlug(a: Author): string | undefined {
  return a.slug;
}

function getNameSlugPair(a: Author): [string, string | undefined] {
  return [a.name, a.slug];
}

export function parseAuthorsFromUrl(url: URL, authors: Author[]): string[] {
  const csv = url.searchParams.get("authors");
  if (csv && csv.length > 0) {
    const parsed = csv.split(",").map(decodeToken).filter(Boolean);
    const slugs: string[] = [];

    if (authors.length > 0) {
      const slugSet = new Set(authors.map(getSlug));
      const nameToSlug = new Map(authors.map(getNameSlugPair));
      for (const token of parsed) {
        if (token === "unknown") {
          slugs.push("");
        } else if (slugSet.has(token)) {
          slugs.push(token);
        } else {
          const slug = nameToSlug.get(token);
          slugs.push(slug || toSlug(token));
        }
      }
    } else {
      for (const token of parsed) slugs.push(toSlug(token));
    }
    return slugs;
  }

  const authorParams = url.searchParams.getAll("author");
  if (authorParams.length > 0) {
    if (authors.length > 0) {
      return authorParams.map(function (a) {
        if (a === "unknown") return "";
        const slugMatch = authors.find(function (x) {
          return x.slug === a;
        });
        if (slugMatch) return slugMatch.slug;
        const nameMatch = authors.find(function (x) {
          return x.name === a;
        });
        return nameMatch ? nameMatch.slug : toSlug(a);
      }) as string[];
    }
    return authorParams.map(toSlug);
  }

  return [];
}

export function buildAuthorsParam(
  selectedAuthors: string[],
  authors: Author[],
): string | undefined {
  if (selectedAuthors.length === 0) return undefined;

  const slugSet = new Set(authors.map(getSlug));
  const nameToSlug = new Map(authors.map(getNameSlugPair));

  return selectedAuthors
    .map(function (x) {
      if (x === "") return "unknown";
      return slugSet.has(x) ? x : (nameToSlug.get(x) ?? toSlug(x));
    })
    .map(encodeToken)
    .join(",");
}

// ---------------------------------------------------------------------------
// Quality Parameter Parsing
// ---------------------------------------------------------------------------

export function parseQualityFromUrl(url: URL): QualityBucket[] | undefined {
  if (!url.searchParams.has("quality")) return undefined;
  const qualityParam = url.searchParams.get("quality");
  if (!qualityParam || qualityParam === "none") return [];
  return qualityParam.split(",").filter(Boolean) as QualityBucket[];
}

export function buildQualityParam(selectedQualityBuckets: QualityBucket[]): string | undefined {
  const allQualityIds = QUALITY_BUCKETS.map(function (b) {
    return b.id;
  });
  const isAllQualitySelected =
    allQualityIds.length === selectedQualityBuckets.length &&
    allQualityIds.every(function (id) {
      return selectedQualityBuckets.includes(id);
    });

  if (selectedQualityBuckets.length === 0) return undefined;
  if (selectedQualityBuckets.includes("none" as any)) return "none";
  return selectedQualityBuckets.join(",");
}

// ---------------------------------------------------------------------------
// People Parameter Parsing
// ---------------------------------------------------------------------------

export function parsePeopleFromUrl(url: URL): string[] {
  const peopleCsv = url.searchParams.get("people");
  if (!peopleCsv) return [];
  if (peopleCsv === "none") return ["none"];
  return peopleCsv.split(",").map(decodeToken).filter(Boolean);
}

export function buildPeopleParam(selectedPeople: string[]): string | undefined {
  if (selectedPeople.length === 0) return undefined;
  if (selectedPeople.includes("none")) return "none";
  return selectedPeople.map(encodeToken).join(",");
}

// ---------------------------------------------------------------------------
// Presence-Only Keys Normalization
// ---------------------------------------------------------------------------

const PRESENCE_ONLY_KEYS = new Set([
  "labels",
  "editMode",
  "debug",
  "overlay",
  "no-separators",
  "sidebar",
  "curation",
  "no-others-snapshots",
  "no-author-snapshots",
  "only-snapshots",
]);

export function normalizePresenceParams(params: URLSearchParams): string {
  const rawPairs = params.toString().split("&").filter(Boolean);
  const normalizedPairs = rawPairs.map(function normalizePair(p) {
    const idx = p.indexOf("=");
    if (idx === -1) return p;
    const key = p.slice(0, idx);
    const val = p.slice(idx + 1);
    if (val === "" && PRESENCE_ONLY_KEYS.has(key)) return key;
    return p;
  });
  return normalizedPairs.join("&");
}

// ---------------------------------------------------------------------------
// Edit Selection Parsing
// ---------------------------------------------------------------------------

export function parseEditSelectionFromUrl(url: URL): Set<string> {
  const editCsv = url.searchParams.get("edit");
  return new Set(editCsv ? editCsv.split(",").filter(Boolean) : []);
}

export function buildEditSelectionParam(selection: Set<string>): string | undefined {
  if (selection.size === 0) return undefined;
  return Array.from(selection).join(",");
}

// ---------------------------------------------------------------------------
// Media Types Parameter Parsing
// ---------------------------------------------------------------------------

const ALL_MEDIA_TYPE_IDS = MEDIA_TYPES.map(function getId(t) {
  return t.id;
});

export function parseMediaTypesFromUrl(url: URL): MediaItemType[] {
  const csv = url.searchParams.get("mediaTypes");
  if (!csv) return [];
  if (csv === "none") return ["none"] as unknown as MediaItemType[];
  return csv.split(",").filter(Boolean) as MediaItemType[];
}

export function buildMediaTypesParam(selected: MediaItemType[]): string | undefined {
  if (selected.length === 0) return undefined;
  if (selected.includes("none" as any)) return "none";
  return selected.join(",");
}

// ---------------------------------------------------------------------------
// Others Snapshots Parameter Parsing
// ---------------------------------------------------------------------------

export function parseOthersSnapshotsFromUrl(url: URL): boolean {
  if (url.searchParams.has("no-others-snapshots")) return false;
  return true;
}

export function buildOthersSnapshotsParam(show: boolean): boolean {
  // Return true if param should be present (show=true means param exists)
  return show;
}

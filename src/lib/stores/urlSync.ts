import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { debug } from "$lib/stores/debug";
import { editMode, selection, showMetadataOverlay } from "$lib/stores/editorState";
import {
  filtersSyncing,
  selectedAuthors,
  selectedQualityBuckets,
  showSeparators,
} from "$lib/stores/filters";
import { showPhotoLabels } from "$lib/stores/photoLabels";
import { activeTab, isCurationMode, isSidebarOpen } from "$lib/stores/uiState";
import type { Author, QualityBucket } from "$lib/types/manifest";
import { QUALITY_BUCKETS } from "$lib/utils/gallery";
import { toSlug } from "$lib/utils/strings";
import { get } from "svelte/store";

let isInitialized = false;
let authors: Author[] = [];
let lastUrl: URL;

function decodeToken(s: string) {
  return decodeURIComponent(s.trim());
}

function encodeToken(s: string) {
  return encodeURIComponent(s);
}

function getSlug(a: Author) {
  return a.slug;
}

function getNameSlugPair(a: Author): [string, string | undefined] {
  return [a.name, a.slug];
}

export function parseBooleanParam(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function encodeBooleanParam(value: boolean) {
  return value ? "true" : "false";
}

function syncBooleanParam(
  params: URLSearchParams,
  key: string,
  value: boolean,
  type: "presence" | "inverted-presence",
) {
  params.delete(key);
  if (type === "presence" && value === true) {
    params.set(key, "");
  } else if (type === "inverted-presence" && value === false) {
    params.set(key, "");
  }
}

function setOrDeleteParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function parseAuthorsFromUrl(url: URL, authors: Author[]): string[] {
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
      return authorParams.map((a) => {
        if (a === "unknown") return "";
        const slugMatch = authors.find((x) => x.slug === a);
        if (slugMatch) return slugMatch.slug;
        const nameMatch = authors.find((x) => x.name === a);
        return nameMatch ? nameMatch.slug : toSlug(a);
      }) as string[];
    }
    return authorParams.map(toSlug);
  }

  return [];
}

function parseQualityFromUrl(url: URL): QualityBucket[] | undefined {
  if (!url.searchParams.has("quality")) return undefined;
  const qualityParam = url.searchParams.get("quality");
  if (!qualityParam) return [];
  return qualityParam.split(",").filter(Boolean) as QualityBucket[];
}

function setBooleanStoreFromUrl(
  url: URL,
  key: string,
  store: { set: (v: boolean) => void },
  defaultValue = false,
) {
  if (url.searchParams.has(key)) {
    const val = url.searchParams.get(key);
    if (val === "" || val === null) {
      store.set(true);
    } else {
      const parsed = parseBooleanParam(val);
      if (parsed !== undefined) store.set(parsed);
    }
  } else {
  }
}

export function initializeFiltersFromUrl(url: URL) {
  if (!browser) return;

  const slugs = parseAuthorsFromUrl(url, authors);
  selectedAuthors.set(slugs);

  const buckets = parseQualityFromUrl(url);
  if (buckets !== undefined) {
    selectedQualityBuckets.set(buckets);
  } else {
    selectedQualityBuckets.set(QUALITY_BUCKETS.map((b) => b.id));
  }

  if (url.searchParams.has("no-separators")) {
    showSeparators.set(false);
  } else {
    const separatorsParam = parseBooleanParam(url.searchParams.get("separators"));
    if (separatorsParam !== undefined) showSeparators.set(separatorsParam);
  }

  setBooleanStoreFromUrl(url, "labels", showPhotoLabels);
  setBooleanStoreFromUrl(url, "editMode", editMode);
  setBooleanStoreFromUrl(url, "debug", debug);
  setBooleanStoreFromUrl(url, "overlay", showMetadataOverlay);
  setBooleanStoreFromUrl(url, "curation", isCurationMode);

  setBooleanStoreFromUrl(url, "sidebar", isSidebarOpen);

  const editCsv = url.searchParams.get("edit");
  selection.set(new Set(editCsv ? editCsv.split(",").filter(Boolean) : []));

  activeTab.set(url.searchParams.get("tab") || "agenda");
}

let debounceTimer: ReturnType<typeof setTimeout>;

const PRESENCE_ONLY_KEYS = new Set([
  "labels",
  "editMode",
  "debug",
  "overlay",
  "no-separators",
  "sidebar",
  "curation",
]);

function buildAuthorsParam(selectedAuthors: string[], authors: Author[]): string | undefined {
  if (selectedAuthors.length === 0) return undefined;

  const slugSet = new Set(authors.map(getSlug));
  const nameToSlug = new Map(authors.map(getNameSlugPair));

  return selectedAuthors
    .map((x) => {
      if (x === "") return "unknown";
      return slugSet.has(x) ? x : (nameToSlug.get(x) ?? toSlug(x));
    })
    .map(encodeToken)
    .join(",");
}

function buildQualityParam(selectedQualityBuckets: QualityBucket[]): string | undefined {
  const allQualityIds = QUALITY_BUCKETS.map((b) => b.id);
  const isAllQualitySelected =
    allQualityIds.length === selectedQualityBuckets.length &&
    allQualityIds.every((id) => selectedQualityBuckets.includes(id));

  return isAllQualitySelected ? undefined : selectedQualityBuckets.join(",");
}

function normalizePresenceParams(params: URLSearchParams): string {
  const rawPairs = params.toString().split("&").filter(Boolean);
  const normalizedPairs = rawPairs.map((p) => {
    // p is like "key=value" or "key=" for empty value
    const idx = p.indexOf("=");
    if (idx === -1) return p;
    const key = p.slice(0, idx);
    const val = p.slice(idx + 1);
    if (val === "" && PRESENCE_ONLY_KEYS.has(key)) return key;
    return p;
  });
  return normalizedPairs.join("&");
}

export function syncUrlFromFilters() {
  if (!browser) return;

  clearTimeout(debounceTimer);
  filtersSyncing.set(true);

  debounceTimer = setTimeout(async () => {
    const $page = get(page);
    const params = new URLSearchParams($page.url.searchParams.toString());

    params.delete("author");
    params.delete("authors");
    const authorsVal = buildAuthorsParam(get(selectedAuthors), authors);
    if (authorsVal) params.set("authors", authorsVal);

    params.delete("quality");
    const qualityVal = buildQualityParam(get(selectedQualityBuckets));
    if (qualityVal !== undefined) params.set("quality", qualityVal);

    params.delete("separators");
    syncBooleanParam(params, "no-separators", get(showSeparators), "inverted-presence");

    syncBooleanParam(params, "labels", get(showPhotoLabels), "presence");
    syncBooleanParam(params, "editMode", get(editMode), "presence");
    syncBooleanParam(params, "debug", get(debug), "presence");
    syncBooleanParam(params, "overlay", get(showMetadataOverlay), "presence");
    syncBooleanParam(params, "sidebar", get(isSidebarOpen), "presence");
    syncBooleanParam(params, "curation", get(isCurationMode), "presence");

    const $selection = get(selection);
    if ($selection.size > 0) {
      params.set("edit", Array.from($selection).join(","));
    } else {
      params.delete("edit");
    }

    params.delete("tab");
    const activeTabVal = get(activeTab);
    if (activeTabVal !== "agenda") {
      params.set("tab", activeTabVal);
    }

    const newQuery = normalizePresenceParams(params);
    const next = `${$page.url.pathname}${newQuery ? `?${newQuery}` : ""}${$page.url.hash}`;
    const current = $page.url.href.replace($page.url.origin, "");

    if (next === current) {
      filtersSyncing.set(false);
      return;
    }

    try {
      await goto(next, { replaceState: true, noScroll: true, keepFocus: true });
      try {
        lastUrl = new URL(next, $page.url.origin);
      } catch {
        /* ignore */
      }
    } finally {
      filtersSyncing.set(false);
    }
  }, 300);
}

export function initUrlSync(initialAuthors: Author[]) {
  if (!browser || isInitialized) return;

  authors = initialAuthors;

  // 1. Initialize stores from URL on first load
  const $page = get(page);
  lastUrl = $page.url;
  initializeFiltersFromUrl($page.url);

  // 2. When filter stores change, update the URL
  selectedAuthors.subscribe(syncUrlFromFilters);
  selectedQualityBuckets.subscribe(syncUrlFromFilters);
  showSeparators.subscribe(syncUrlFromFilters);
  showPhotoLabels.subscribe(syncUrlFromFilters);
  selection.subscribe(syncUrlFromFilters);
  editMode.subscribe(syncUrlFromFilters);
  showMetadataOverlay.subscribe(syncUrlFromFilters);
  debug.subscribe(syncUrlFromFilters);
  activeTab.subscribe(syncUrlFromFilters);
  isSidebarOpen.subscribe(syncUrlFromFilters);
  isCurationMode.subscribe(syncUrlFromFilters);

  // 3. When URL changes (e.g., back/forward button), update the filter stores
  page.subscribe((newPage) => {
    if (get(filtersSyncing)) return;

    if (newPage.url.toString() !== lastUrl.toString()) {
      lastUrl = newPage.url;
      initializeFiltersFromUrl(newPage.url);
    }
  });

  isInitialized = true;
}

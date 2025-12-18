import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { debug } from "$lib/stores/debug";
import { editMode, selection, showMetadataOverlay } from "$lib/stores/editorState";
import {
    filtersSyncing,
    selectedAuthors,
    selectedQualityBuckets,
    showSeparators
} from "$lib/stores/filters";
import { showPhotoLabels } from "$lib/stores/photoLabels";
import { activeTab, isCurationMode, isSidebarOpen } from "$lib/stores/uiState";
import type { Author } from "$lib/types/manifest";
import { QUALITY_BUCKETS } from "$lib/utils/gallery";
import { toSlug } from "$lib/utils/strings";
import { get } from "svelte/store";

let isInitialized = false;
let authors: Author[] = [];
let lastUrl: URL;

// --- Helper Functions ---

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

// --- Helpers ---

/**
 * Parses `1`/`0` and `true`/`false` (case-insensitive) into booleans.
 * Returns `undefined` for null or unknown values.
 */
export function parseBooleanParam(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/**
 * Encodes a boolean into a canonical string used in URLs.
 */
function encodeBooleanParam(value: boolean) {
  return value ? "true" : "false";
}

/**
 * Helper to sync boolean values to URL params.
 * @param params The search params object
 * @param key The key to set/delete
 * @param value The boolean value
 * @param type 'presence' (key means true) or 'inverted-presence' (key means false)
 */
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

/**
 * Helper to set or delete a param based on value existence.
 * @param params The search params object
 * @param key The key
 * @param value The value (if falsy/empty, key is deleted)
 */
function setOrDeleteParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

// --- Logic ---

/**
 * Updates the Svelte stores based on the current URL's query parameters.
 */
export function initializeFiltersFromUrl(url: URL) {
  if (!browser) return;

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
          if (slug) {
            slugs.push(slug);
          } else {
            slugs.push(toSlug(token));
          }
        }
      }
    } else {
      for (const token of parsed) slugs.push(toSlug(token));
    }
    selectedAuthors.set(slugs);
  } else {
    const authorParams = url.searchParams.getAll("author");
    if (authorParams.length > 0) {
      const slugs =
        authors.length > 0
          ? (authorParams.map((a) => {
              if (a === "unknown") return "";
              const slugMatch = authors.find((x) => x.slug === a);
              if (slugMatch) return slugMatch.slug;
              const nameMatch = authors.find((x) => x.name === a);
              if (nameMatch) return nameMatch.slug;
              return toSlug(a);
            }) as string[])
          : authorParams.map(toSlug);
      selectedAuthors.set(slugs);
    } else {
      selectedAuthors.set([]);
    }
  }

  // Quality
  // If param exists, respect it (even if empty -> None).
  // If param missing, default to ALL.
  if (url.searchParams.has("quality")) {
    const qualityParam = url.searchParams.get("quality");
    if (qualityParam) {
      const buckets = qualityParam.split(",").filter(Boolean);
      selectedQualityBuckets.set(buckets);
    } else {
      selectedQualityBuckets.set([]); // If param exists but is empty, set to empty array
    }
  } else {
    selectedQualityBuckets.set(QUALITY_BUCKETS.map((b) => b.id));
  }

    const qualityCsv = url.searchParams.get("quality") || "";
    const buckets = qualityCsv.split(",").filter(Boolean);
    selectedAestheticBuckets.set(buckets);
  } else {
    selectedAestheticBuckets.set(AESTHETIC_BUCKETS.map((b) => b.id));
  }


  // Presence-only flag: `no-separators` (preferred) means disabled.
  if (url.searchParams.has("no-separators")) {
    showSeparators.set(false);
  } else {
    const separatorsParam = parseBooleanParam(url.searchParams.get("separators"));
    if (separatorsParam !== undefined) showSeparators.set(separatorsParam);
  }

  // Helper for simple boolean params
  const setBooleanFromUrl = (key: string, store: { set: (v: boolean) => void }) => {
    if (url.searchParams.has(key)) {
      const val = url.searchParams.get(key);
      if (val === "" || val === null) {
        store.set(true);
      } else {
        const parsed = parseBooleanParam(val);
        if (parsed !== undefined) store.set(parsed);
      }
    }
  };

  setBooleanFromUrl("labels", showPhotoLabels);
  setBooleanFromUrl("editMode", editMode);
  setBooleanFromUrl("debug", debug);
  setBooleanFromUrl("overlay", showMetadataOverlay);
  setBooleanFromUrl("curation", isCurationMode);

  // Special logic for sidebar (can be explicitly closed via sidebar=false)
  if (url.searchParams.has("sidebar")) {
    const val = url.searchParams.get("sidebar");
    if (val === "" || val === null) {
      isSidebarOpen.set(true);
    } else {
      const parsed = parseBooleanParam(val);
      if (parsed !== undefined) isSidebarOpen.set(parsed);
    }
  } else {
    isSidebarOpen.set(false);
  }

  const editCsv = url.searchParams.get("edit");
  if (editCsv) {
    const ids = new Set(editCsv.split(",").filter(Boolean));
    selection.set(ids);
  } else {
    selection.set(new Set());
  }

  const tabParam = url.searchParams.get("tab");
  if (tabParam) {
    activeTab.set(tabParam);
  } else {
    activeTab.set("agenda");
  }
}

let debounceTimer: ReturnType<typeof setTimeout>;

/**
 * Reads the Svelte stores and updates the URL query parameters to match.
 * This function is debounced to prevent excessive history updates.
 */
export function syncUrlFromFilters() {
  if (!browser) return;

  clearTimeout(debounceTimer);
  filtersSyncing.set(true);

  debounceTimer = setTimeout(async () => {
    const $page = get(page);
    const params = new URLSearchParams($page.url.searchParams.toString());

    params.delete("author");
    params.delete("authors");

    const $selectedAuthors = get(selectedAuthors);
    if ($selectedAuthors.length > 0) {
      const slugSet = new Set(authors.map(getSlug));
      const nameToSlug = new Map(authors.map(getNameSlugPair));
      const slugs = $selectedAuthors
        .map((x) => {
          if (x === "") return "unknown";
          return slugSet.has(x) ? x : (nameToSlug.get(x) ?? toSlug(x));
        })
        .map(encodeToken);
      params.set("authors", slugs.join(","));
    }

    // Quality
    const $selectedQualityBuckets = get(selectedQualityBuckets);
    const allQualityIds = QUALITY_BUCKETS.map((b) => b.id);
    const isAllQualitySelected =
      allQualityIds.length === $selectedQualityBuckets.length &&
      allQualityIds.every((id) => $selectedQualityBuckets.includes(id));

    if (isAllQualitySelected) {
      params.delete("quality");
    } else {
      params.set("quality", $selectedQualityBuckets.join(","));
    }




    // Only include non-default values in the URL so clearing filters removes the query string.
    // Only include non-default values in the URL so clearing filters removes the query string.
    const separatorsVal = get(showSeparators);
    // Prefer presence-only inverted flag `no-separators` to indicate disabled state.
    params.delete("separators");
    syncBooleanParam(params, "no-separators", separatorsVal, "inverted-presence");

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

    const activeTabVal = get(activeTab);
    params.delete("tab");
    if (activeTabVal !== "agenda") {
      params.set("tab", activeTabVal);
    }

    // Serialize params but render presence-only keys without trailing '='
    const presenceOnlyKeys = new Set([
      "labels",
      "editMode",
      "debug",
      "overlay",
      "no-separators",
      "sidebar",
      "curation",
    ]);
    const rawPairs = params.toString().split("&").filter(Boolean);
    const normalizedPairs = rawPairs.map((p) => {
      // p is like "key=value" or "key=" for empty value
      const idx = p.indexOf("=");
      if (idx === -1) return p;
      const key = p.slice(0, idx);
      const val = p.slice(idx + 1);
      if (val === "" && presenceOnlyKeys.has(key)) return key;
      return p;
    });
    const newQuery = normalizedPairs.join("&");
    const next = `${$page.url.pathname}${newQuery ? `?${newQuery}` : ""}${$page.url.hash}`;
    const current = $page.url.href.replace($page.url.origin, "");

    if (next === current) {
      filtersSyncing.set(false);
      return;
    }

    try {
      await goto(next, {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
      // Update the cached lastUrl to reflect the new URL we just navigated to
      try {
        lastUrl = new URL(next, $page.url.origin);
      } catch (e) {
        // ignore if we cannot construct the URL for some reason
      }
      // After navigation, the page store will update, which will trigger the subscription below
    } finally {
      filtersSyncing.set(false);
    }
  }, 300);
}

/**
 * Initializes the two-way synchronization between filter stores and the URL.
 * Should be called once from the root layout.
 * @param initialAuthors The list of all authors to enable slug/name mapping.
 */
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
  selectedAestheticBuckets.subscribe(syncUrlFromFilters);
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

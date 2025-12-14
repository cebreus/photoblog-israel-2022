import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import {
  filtersSyncing,
  selectedAuthors,
  showSeparators,
} from "$lib/stores/filters";
import { showPhotoLabels } from "$lib/stores/photoLabels";
import { selection, editMode } from "$lib/stores/editorState";
import { debug } from "$lib/stores/debug";
import { activeTab, isSidebarOpen } from "$lib/stores/uiState";
import type { Author } from "$lib/types/manifest";
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

// --- Logic ---

/**
 * Updates the Svelte stores based on the current URL's query parameters.
 */
function initializeFiltersFromUrl(url: URL) {
  if (!browser) return;

  const csv = url.searchParams.get("authors");
  if (csv && csv.length > 0) {
    const parsed = csv.split(",").map(decodeToken).filter(Boolean);
    const slugs: string[] = [];

    if (authors.length > 0) {
      const slugSet = new Set(authors.map(getSlug));
      const nameToSlug = new Map(authors.map(getNameSlugPair));
      for (const token of parsed) {
        if (slugSet.has(token)) {
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
    selectedAuthors.set(slugs.filter(Boolean));
  } else {
    const authorParams = url.searchParams.getAll("author");
    if (authorParams.length > 0) {
      const slugs =
        authors.length > 0
          ? (authorParams.map((a) => {
              const slugMatch = authors.find((x) => x.slug === a);
              if (slugMatch) return slugMatch.slug;
              const nameMatch = authors.find((x) => x.name === a);
              if (nameMatch) return nameMatch.slug;
              return toSlug(a);
            }) as string[])
          : authorParams.map(toSlug);
      selectedAuthors.set(slugs.filter(Boolean));
    } else {
      selectedAuthors.set([]);
    }
  }

  const separatorsParam = parseBooleanParam(url.searchParams.get("separators"));
  // Presence-only flag: `no-separators` (preferred) means disabled.
  if (url.searchParams.has("no-separators")) {
    showSeparators.set(false);
  } else {
    const separatorsParam = parseBooleanParam(
      url.searchParams.get("separators"),
    );
    if (separatorsParam !== undefined) showSeparators.set(separatorsParam);
  }

  // Presence-only flag: `labels` (no value) means enabled.
  if (url.searchParams.has("labels")) {
    showPhotoLabels.set(true);
  } else {
    const labelsParam = parseBooleanParam(url.searchParams.get("labels"));
    if (labelsParam !== undefined) showPhotoLabels.set(labelsParam);
  }

  const editCsv = url.searchParams.get("edit");
  if (editCsv) {
    const ids = new Set(editCsv.split(",").filter(Boolean));
    selection.set(ids);
  } else {
    selection.set(new Set());
  }
  // Presence-only flags: `editMode` and `debug` mean enabled when present.
  if (url.searchParams.has("editMode")) {
    editMode.set(true);
  } else {
    const editModeParam = parseBooleanParam(url.searchParams.get("editMode"));
    if (editModeParam !== undefined) editMode.set(editModeParam);
  }

  if (url.searchParams.has("debug")) {
    debug.set(true);
  } else {
    const debugParam = parseBooleanParam(url.searchParams.get("debug"));
    if (debugParam !== undefined) debug.set(debugParam);
  }

  const tabParam = url.searchParams.get("tab");
  if (tabParam) {
    activeTab.set(tabParam);
  } else {
    activeTab.set("agenda");
  }

  // Presence-only flag: `sidebar` means enabled (open).
  if (url.searchParams.has("sidebar")) {
    isSidebarOpen.set(true);
  } else {
    // If param is missing, we assume sidebar should be closed (or strictly follow URL state).
    // User requested explicit param for OPEN state.
    isSidebarOpen.set(false);
  }
}

let debounceTimer: ReturnType<typeof setTimeout>;

/**
 * Reads the Svelte stores and updates the URL query parameters to match.
 * This function is debounced to prevent excessive history updates.
 */
function syncUrlFromFilters() {
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
        .map((x) => (slugSet.has(x) ? x : (nameToSlug.get(x) ?? toSlug(x))))
        .map(encodeToken);
      params.set("authors", slugs.join(","));
    }

    // Only include non-default values in the URL so clearing filters removes the query string.
    const separatorsVal = get(showSeparators);
    // Prefer presence-only inverted flag `no-separators` to indicate disabled state.
    params.delete("separators");
    if (separatorsVal === false) {
      params.set("no-separators", "");
    } else {
      params.delete("no-separators");
    }

    const labelsVal = get(showPhotoLabels);
    // Presence-only flag `labels` means enabled.
    params.delete("labels");
    if (labelsVal === true) {
      params.set("labels", "");
    }

    const $selection = get(selection);
    if ($selection.size > 0) {
      params.set("edit", Array.from($selection).join(","));
    } else {
      params.delete("edit");
    }

    const editModeVal = get(editMode);
    params.delete("editMode");
    if (editModeVal === true) params.set("editMode", "");

    const debugVal = get(debug);
    params.delete("debug");
    if (debugVal === true) params.set("debug", "");

    const activeTabVal = get(activeTab);
    params.delete("tab");
    if (activeTabVal !== "agenda") {
      params.set("tab", activeTabVal);
    }

    const isSidebarOpenVal = get(isSidebarOpen);
    params.delete("sidebar");
    if (isSidebarOpenVal === true) params.set("sidebar", "");

    // Serialize params but render presence-only keys without trailing '='
    const presenceOnlyKeys = new Set([
      "labels",
      "editMode",
      "debug",
      "no-separators",
      "sidebar",
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
  showSeparators.subscribe(syncUrlFromFilters);
  showPhotoLabels.subscribe(syncUrlFromFilters);
  selection.subscribe(syncUrlFromFilters);
  editMode.subscribe(syncUrlFromFilters);
  debug.subscribe(syncUrlFromFilters);
  activeTab.subscribe(syncUrlFromFilters);
  isSidebarOpen.subscribe(syncUrlFromFilters);

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

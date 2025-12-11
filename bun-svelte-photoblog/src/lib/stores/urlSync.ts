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

  showSeparators.set(url.searchParams.get("separators") !== "0");
  showPhotoLabels.set(url.searchParams.get("labels") === "1");

  const editCsv = url.searchParams.get("edit");
  if (editCsv) {
    const ids = new Set(editCsv.split(",").filter(Boolean));
    selection.set(ids);
  } else {
    selection.set(new Set());
  }
  editMode.set(url.searchParams.get("editMode") === "true");
  debug.set(url.searchParams.get("debug") === "1");
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

    if (get(showSeparators) === false) {
      params.set("separators", "0");
    } else {
      params.delete("separators");
    }

    if (get(showPhotoLabels)) {
      params.set("labels", "1");
    } else {
      params.delete("labels");
    }

    const $selection = get(selection);
    if ($selection.size > 0) {
      params.set("edit", Array.from($selection).join(","));
    } else {
      params.delete("edit");
    }

    if (get(editMode)) {
      params.set("editMode", "true");
    } else {
      params.delete("editMode");
    }

    if (get(debug)) {
      params.set("debug", "1");
    } else {
      params.delete("debug");
    }

    const next = `${$page.url.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }${$page.url.hash}`;
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

  // 3. When URL changes (e.g., back/forward button), update the filter stores
  page.subscribe((newPage) => {
    if (newPage.url.toString() !== lastUrl.toString()) {
      lastUrl = newPage.url;
      initializeFiltersFromUrl(newPage.url);
    }
  });

  isInitialized = true;
}

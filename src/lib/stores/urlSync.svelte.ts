import { browser, dev } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { editor } from "$lib/stores/editor.svelte";
import { filters } from "$lib/stores/filters.svelte";
import { ui } from "$lib/stores/ui.svelte";
import type { Author } from "$lib/types/manifest";
import { QUALITY_BUCKETS } from "$lib/utils/gallery";
import {
  buildAuthorsParam,
  buildQualityParam,
  decodeToken,
  encodeToken,
  normalizePresenceParams,
  parseAuthorsFromUrl,
  parseBooleanParam,
  parseQualityFromUrl,
  syncBooleanParam,
} from "$lib/utils/url-params";

let isInitialized = false;
let authors: Author[] = [];
let lastUrl: URL;

function setBooleanStateFromUrl(
  url: URL,
  key: string,
  setter: (v: boolean) => void,
  defaultValue?: boolean,
) {
  if (url.searchParams.has(key)) {
    const val = url.searchParams.get(key);
    if (val === "" || val === null) {
      setter(true);
    } else {
      const parsed = parseBooleanParam(val);
      if (parsed !== undefined) setter(parsed);
    }
  } else if (defaultValue !== undefined) {
    setter(defaultValue);
  }
}

export function initializeFiltersFromUrl(url: URL) {
  if (!browser) return;

  const slugs = parseAuthorsFromUrl(url, authors);
  filters.selectedAuthors = slugs;

  const buckets = parseQualityFromUrl(url);
  if (buckets !== undefined) {
    filters.selectedQualityBuckets = buckets;
  } else {
    filters.selectedQualityBuckets = QUALITY_BUCKETS.map((b) => b.id);
  }

  if (url.searchParams.has("no-separators")) {
    filters.showSeparators = false;
  } else {
    const separatorsParam = parseBooleanParam(url.searchParams.get("separators"));
    if (separatorsParam !== undefined) filters.showSeparators = separatorsParam;
  }

  setBooleanStateFromUrl(url, "labels", (v) => {
    ui.photoLabels = v;
  });
  if (dev) {
    setBooleanStateFromUrl(url, "editMode", (v) => {
      editor.editMode = v;
    });
    setBooleanStateFromUrl(url, "debug", (v) => {
      ui.debugMode = v;
    });
    setBooleanStateFromUrl(url, "overlay", (v) => {
      editor.showMetadataOverlay = v;
    });
    setBooleanStateFromUrl(url, "curation", (v) => {
      ui.curationMode = v;
    });
  }

  setBooleanStateFromUrl(
    url,
    "sidebar",
    (v) => {
      ui.sidebarOpen = v;
    },
    true,
  );

  const peopleCsv = url.searchParams.get("people");
  filters.selectedPeople = peopleCsv ? peopleCsv.split(",").map(decodeToken).filter(Boolean) : [];

  const editCsv = url.searchParams.get("edit");
  editor.selection = new Set(editCsv ? editCsv.split(",").filter(Boolean) : []);

  ui.activeTab = url.searchParams.get("tab") || "agenda";
}

let debounceTimer: ReturnType<typeof setTimeout>;

export function syncUrlFromFilters() {
  if (!browser) return;

  clearTimeout(debounceTimer);
  filters.filtersSyncing = true;

  debounceTimer = setTimeout(async () => {
    const pageVal = page;
    const params = new URLSearchParams(pageVal.url.searchParams.toString());

    params.delete("author");
    params.delete("authors");
    const authorsVal = buildAuthorsParam(filters.selectedAuthors, authors);
    if (authorsVal) params.set("authors", authorsVal);

    params.delete("quality");
    const qualityVal = buildQualityParam(filters.selectedQualityBuckets);
    if (qualityVal !== undefined) params.set("quality", qualityVal);

    params.delete("people");
    const people = filters.selectedPeople;
    if (people.length > 0) params.set("people", people.map(encodeToken).join(","));

    params.delete("separators");
    syncBooleanParam(params, "no-separators", filters.showSeparators, "inverted-presence");

    syncBooleanParam(params, "labels", ui.photoLabels, "presence");
    syncBooleanParam(params, "editMode", editor.editMode, "presence");
    syncBooleanParam(params, "debug", ui.debugMode, "presence");
    syncBooleanParam(params, "overlay", editor.showMetadataOverlay, "presence");
    syncBooleanParam(params, "sidebar", ui.sidebarOpen, "presence");
    syncBooleanParam(params, "curation", ui.curationMode, "presence");

    const selectionVal = editor.selection;
    if (selectionVal.size > 0) {
      params.set("edit", Array.from(selectionVal).join(","));
    } else {
      params.delete("edit");
    }

    params.delete("tab");
    const activeTabVal = ui.activeTab;
    if (activeTabVal !== "agenda") {
      params.set("tab", activeTabVal);
    }

    const newQuery = normalizePresenceParams(params);
    const next = `${pageVal.url.pathname}${newQuery ? `?${newQuery}` : ""}${pageVal.url.hash}`;
    const current = pageVal.url.href.replace(pageVal.url.origin, "");

    if (next === current) {
      filters.filtersSyncing = false;
      return;
    }

    try {
      // CRITICAL FIX: Update lastUrl BEFORE goto to prevent the URL-watch effect
      // from re-parsing our own URL change as an external navigation
      try {
        lastUrl = new URL(next, pageVal.url.origin);
      } catch {
        /* ignore */
      }
      await goto(next, { replaceState: true, noScroll: true, keepFocus: true });
    } finally {
      // Delay clearing filtersSyncing to allow the render cycle to complete
      // This prevents race conditions where the URL effect fires before we're done
      setTimeout(() => {
        filters.filtersSyncing = false;
      }, 50);
    }
  }, 300);
}

/**
 * Scrolls to the element matching the current URL hash on initial page load.
 * Called once after DOM is ready.
 */
function scrollToInitialHash(): void {
  const hash = window.location.hash.slice(1); // Remove leading #
  if (!hash) return;

  // Small delay to ensure DOM elements are rendered
  requestAnimationFrame(() => {
    const element = document.getElementById(hash);
    if (element) {
      element.scrollIntoView({ behavior: "instant", block: "start" });
    }
  });
}

export function initUrlSync(initialAuthors: Author[]) {
  if (!browser || isInitialized) return;

  authors = initialAuthors;

  const pageVal = page;
  lastUrl = pageVal.url;
  initializeFiltersFromUrl(pageVal.url);

  // Scroll to initial hash after a brief delay for DOM to be ready
  setTimeout(scrollToInitialHash, 100);

  // 2. Setup effects for automatic URL updates
  $effect.root(() => {
    $effect(() => {
      // Access reactive properties to trigger tracking
      filters.selectedAuthors;
      filters.selectedQualityBuckets;
      filters.showSeparators;
      ui.photoLabels;
      editor.selection;
      editor.editMode;
      editor.showMetadataOverlay;
      ui.debugMode;
      ui.activeTab;
      ui.sidebarOpen;
      ui.curationMode;
      filters.selectedPeople;

      syncUrlFromFilters();
    });

    // 3. When URL changes (e.g., back/forward button), update the states
    $effect(() => {
      const newPage = page;
      if (filters.filtersSyncing) return;

      if (newPage.url.toString() !== lastUrl.toString()) {
        lastUrl = newPage.url;
        initializeFiltersFromUrl(newPage.url);
      }
    });
  });

  isInitialized = true;
}

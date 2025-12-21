import { browser, dev } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { editor } from "$lib/stores/editor.svelte";
import { filters } from "$lib/stores/filters.svelte";
import { ui } from "$lib/stores/ui.svelte";
import type { Author, QualityBucket } from "$lib/types/manifest";
import { QUALITY_BUCKETS } from "$lib/utils/gallery";
import { toSlug } from "$lib/utils/strings";

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
    false,
  );

  const peopleCsv = url.searchParams.get("people");
  filters.selectedPeople = peopleCsv ? peopleCsv.split(",").map(decodeToken).filter(Boolean) : [];

  const editCsv = url.searchParams.get("edit");
  editor.selection = new Set(editCsv ? editCsv.split(",").filter(Boolean) : []);

  ui.activeTab = url.searchParams.get("tab") || "agenda";
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
      await goto(next, { replaceState: true, noScroll: true, keepFocus: true });
      try {
        lastUrl = new URL(next, pageVal.url.origin);
      } catch {
        /* ignore */
      }
    } finally {
      filters.filtersSyncing = false;
    }
  }, 300);
}

export function initUrlSync(initialAuthors: Author[]) {
  if (!browser || isInitialized) return;

  authors = initialAuthors;

  const pageVal = page;
  lastUrl = pageVal.url;
  initializeFiltersFromUrl(pageVal.url);

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

<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import faviconHtml from "../../.temp/favicons.html?raw";
  import "../app.css";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import {
    selectedAuthors,
    showSeparators,
    filtersSyncing,
  } from "$lib/stores/filters";
  import { showLocationPins } from "$lib/stores/mapLocations";
  import { debug } from "$lib/stores/debug";

  let { data, children } = $props();

  $effect(() => debug.initializeFromUrl($page.url));

  // Version 1 — parse filters from URL query params on page load/navigation
  // Supported params:
  //   - author=Name  (repeatable)
  //   - separators=0|1  (boolean; present and 0 => false)
  //   - pins=0|1        (show map pins; present and 1 => true)
  $effect(() => {
    if (!browser) return;
    const url = $page.url;

    // authors (support both repeatable `author=` and CSV `authors=`)
    // prefer `authors=` csv if present, otherwise fall back to repeated `author=` params
    const csv = url.searchParams.get("authors");
    if (csv && csv.length > 0) {
      const parsed = csv
        .split(",")
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean);
      selectedAuthors.set(parsed);
    } else {
      const authors = url.searchParams.getAll("author");
      if (authors && authors.length > 0) selectedAuthors.set(authors);
    }

    // separators (optional) — default is true when not present
    if (url.searchParams.has("separators")) {
      const v = url.searchParams.get("separators");
      showSeparators.set(!(v === "0" || v === "false"));
    }

    // pins (optional) — default is false when not present
    if (url.searchParams.has("pins")) {
      const v = url.searchParams.get("pins");
      showLocationPins.set(v === "1" || v === "true");
    }
  });

  // Keep the URL updated when stores change (uses replaceState so history
  // isn't polluted). This mirrors the parsed params and makes the current
  // filters shareable.
  // Debounced URL writer — avoid spamming navigation during rapid store changes
  let _updateTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 300;

  $effect(() => {
    if (!browser) return;

    // cancel previous pending write
    if (_updateTimer) clearTimeout(_updateTimer);

    // indicate a pending sync while debounce timer is active
    filtersSyncing.set(true);

    // schedule new write
    _updateTimer = setTimeout(async () => {
      // use CSV `authors=` format for smaller URLs (preferred)
      const cur = $page.url;
      const params = new URLSearchParams(cur.searchParams.toString());

      // authors -> authors=csv
      params.delete("author");
      params.delete("authors");
      if ($selectedAuthors && $selectedAuthors.length > 0) {
        // encode each author (commas are not encoded by default, so encode entries)
        // we'll join with commas for the CSV param
        const encoded = $selectedAuthors
          .map((a) => encodeURIComponent(a.trim()))
          .join(",");
        params.set("authors", encoded);
      }

      // separators — only encode when explicitly different from default true
      if ($showSeparators === false) params.set("separators", "0");
      else params.delete("separators");

      // pins — only encode when true (default false)
      if ($showLocationPins) params.set("pins", "1");
      else params.delete("pins");

      const next = `${cur.pathname}${params.toString() ? `?${params.toString()}` : ""}`;

      // don't write if identical
      if (next === cur.href.replace(cur.origin, "")) return;

      // write and clear pending flag (goto returns a promise)
      try {
        await goto(next, {
          replaceState: true,
          noScroll: true,
          keepFocus: true,
        });
      } finally {
        filtersSyncing.set(false);
        _updateTimer = null;
      }
    }, DEBOUNCE_MS);
  });

  $effect(() => {
    document.documentElement.classList.toggle(
      "show-locations",
      $showLocationPins,
    );
  });
</script>

<svelte:head>
  {@html faviconHtml}
</svelte:head>

<Header menuItems={data.menuItems} authors={data.authors} />

{@render children?.()}

<Footer />

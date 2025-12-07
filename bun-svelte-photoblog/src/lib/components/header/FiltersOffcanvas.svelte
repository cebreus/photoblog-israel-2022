<script lang="ts">
  import { buttonVariants } from "$lib/components/ui/button/button.svelte";
  import * as Offcanvas from "$lib/components/offcanvas";
  import { showLocationPins } from "$lib/stores/mapLocations";
  import { selectedAuthors, showSeparators } from "$lib/stores/filters";
  import { Switch } from "$lib/components/ui/switch";
  import { SlidersHorizontal } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge/";
  import { pluralizeCzech, pluralizeCount } from "$lib/utils";
  // import { filtersSyncing } from "$lib/stores/filters"; // unused import removed
  import { debug } from "$lib/stores/debug";
  import { get as getStore } from "svelte/store";
  import { getPhotoDays } from "$lib/images";
  import { filterGalleryItems } from "$lib/filter-utils";
  type AuthorStats = {
    name: string;
    count: number;
  };

  let { authors = [] } = $props<{ authors?: AuthorStats[] }>();

  import { onMount } from "svelte";

  // from the passed authors list.
  onMount(() => {
    const initial = $selectedAuthors;
    if ((!initial || initial.length === 0) && authors.length > 0) {
      selectedAuthors.set(authors.map((a: AuthorStats) => a.name));
    }
  });

  let totalPhotos = $state(0);
  let totalAuthors = $state(0);
  let totalLocations = $state(0);

  $effect(() => {
    totalPhotos = authors.reduce(
      (sum: number, author: AuthorStats) => sum + author.count,
      0,
    );
    totalAuthors = authors.length;
  });

  // visible items counter for the whole site based on canonical manifest
  let visiblePhotos = $state(0);

  $effect(() => {
    const days = getPhotoDays();
    visiblePhotos = days.reduce((sum, day) => {
      const filtered = filterGalleryItems(
        day.items,
        $selectedAuthors,
        $showSeparators,
      );
      return sum + filtered.filter((it) => (it as any).type === "image").length;
    }, 0);
  });

  // compute total unique locations across manifest
  $effect(() => {
    const days = getPhotoDays();
    const set = new Set<string>();
    for (const d of days) {
      // PhotoDay type doesn't currently include `locations` in the TS model
      // so read it defensively via any to satisfy the compiler and runtime.
      const locs = (d as any).locations;
      if (locs && Array.isArray(locs)) {
        for (const loc of locs) set.add(loc);
      }
    }
    totalLocations = set.size;
  });

  // no bulk select controls — kept filters minimal per request

  function toggleAuthor(name: string) {
    // debug: log previous selection and intended outcome
    const previous = $selectedAuthors;
    if (getStore(debug))
      console.debug("filters: toggleAuthor start", { name, previous });

    selectedAuthors.update((current) => {
      const isSelected = current.includes(name);

      const next = isSelected
        ? current.filter((author) => author !== name)
        : [...current, name];
      // small debug after update — executed synchronously by update callback
      // but we also log after update in a separate microtask for guaranteed visibility
      setTimeout(() => {
        if (getStore(debug))
          console.debug("filters: toggleAuthor result", {
            name,
            prev: current,
            next,
          });
      }, 0);

      return next;
    });
  }
</script>

<Offcanvas.Root>
  <Offcanvas.Trigger
    class={buttonVariants({
      size: "icon",
      variant: "ghost",
    })}
    data-testid="filters-offcanvas-trigger"
  >
    <SlidersHorizontal strokeWidth={2.5} />
  </Offcanvas.Trigger>

  <Offcanvas.Content
    side="right"
    className="overflow-y-auto text-foreground"
    data-testid="filters-offcanvas"
  >
    <div class="py-4 px-6 border-b">
      <h2 class="text-md font-semibold">Filtry</h2>
    </div>

    <!-- stats block: photos (total/visible) / authors / locations -->
    <div
      class="relative px-6 py-4 border-b grid grid-cols-3 gap-4 text-center text-sm text-slate-400 bg-slate-100"
      data-testid="filters-stats"
    >
      <!-- debounce UI indicator removed per request; keep data-testid attributes intact -->
      <!-- All three columns follow the same visual pattern: large number(s) on top, small label below -->
      <div>
        <div
          class="font-semibold text-foreground text-lg tracking-tight"
          data-testid="filters-stats-photos"
        >
          <span class="mr-2">{totalPhotos}</span>
          <span class="text-slate-400">/</span>
          <span class="ml-2">{visiblePhotos}</span>
        </div>
        <div class="text-xs text-slate-500">Fotky (celkem / zobrazeno)</div>
      </div>

      <div>
        <div
          class="font-semibold text-foreground text-lg tracking-tight"
          data-testid="filters-stats-authors"
        >
          {totalAuthors}
        </div>
        <div class="text-xs text-slate-500">Autoři</div>
      </div>

      <div>
        <div
          class="font-semibold text-foreground text-lg tracking-tight"
          data-testid="filters-stats-stops"
        >
          {totalLocations}
        </div>
        <div class="text-xs text-slate-500">Zastávek</div>
      </div>
    </div>
    <div
      class="px-6 py-4 border-b flex items-center justify-between gap-4"
      data-testid="filters-location-control"
    >
      <div>
        <p class="text-sm font-semibold">Zobrazit lokace</p>
        <p class="text-xs text-slate-400">Zobrazí označení míst na mapě</p>
      </div>
      <Switch
        bind:checked={$showLocationPins}
        aria-label={$showLocationPins ? "Skrýt lokace" : "Zobrazit lokace"}
        data-testid="filters-location-switch"
      />
    </div>
    <div class="px-6 py-4 border-b flex items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold">Zobrazit zastávky</p>
        <p class="text-xs text-slate-400">Popisky zastávek na cestě</p>
      </div>
      <Switch
        bind:checked={$showSeparators}
        aria-label={$showSeparators ? "Skrýt zastávky" : "Zobrazit zastávky"}
        data-testid="filters-separators-switch"
      />
    </div>
    <div class="px-6 py-4 border-b space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">Autoři</p>
        <!-- intentionally no bulk controls -->
        <!-- removed aggregate counts from author header; stats are shown above -->
      </div>
      <div class="flex flex-col gap-3">
        {#each authors as author (author.name)}
          {@const isActive = $selectedAuthors.includes(author.name)}
          <div
            class={`flex items-center justify-between text-sm ${
              isActive ? "text-primary" : "text-slate-100"
            }`}
            data-testid={`filters-author-${author.name.replace(/\s+/g, "-")}`}
            role="button"
            tabindex="0"
            onclick={() => toggleAuthor(author.name)}
            onkeydown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                toggleAuthor(author.name);
              }
            }}
          >
            <span class="flex items-center gap-2">
              <span>{author.name}</span>
              <Badge variant="outline">{author.count}</Badge>
            </span>
            <span
              class="inline-flex"
              role="presentation"
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => e.stopPropagation()}
            >
              <Switch
                checked={isActive}
                aria-label={isActive
                  ? `Vypnout filtr ${author.name}`
                  : `Zapnout filtr ${author.name}`}
                data-testid={`filters-author-switch-${author.name.replace(/\s+/g, "-")}`}
                onCheckedChange={() => toggleAuthor(author.name)}
              />
            </span>
          </div>
        {/each}
      </div>
    </div>
  </Offcanvas.Content>
</Offcanvas.Root>

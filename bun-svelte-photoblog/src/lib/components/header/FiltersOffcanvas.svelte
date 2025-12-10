<script lang="ts">
  import { buttonVariants } from "$lib/components/ui/button/button.svelte";
  import * as Offcanvas from "$lib/components/offcanvas";
  import { showPhotoLabels } from "$lib/stores/photoLabels";
  import {
    selectedAuthors,
    showSeparators,
    visiblePhotos,
  } from "$lib/stores/filters";
  import { Switch } from "$lib/components/ui/switch";
  import { SlidersHorizontal, Sun, Moon, Monitor } from "lucide-svelte";
  import { setMode, resetMode, mode } from "mode-watcher";
  import { Badge } from "$lib/components/ui/badge/";
  import { pluralizeCzech, pluralizeCount, toSlug } from "$lib/utils/strings";
  import { get as getStore } from "svelte/store";
  import { getMenuItems } from "$lib/utils/menu";
  import { debug } from "$lib/stores/debug";
  import type { Author, MenuDay } from "$lib/types/manifest";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let { authors = [] } = $props<{ authors?: AuthorStats[] }>();

  // initial population of selectedAuthors is handled centrally in +layout.svelte

  let totalPhotos = $state(0);
  let totalAuthors = $state(0);
  const totalLocations = getMenuItems().reduce(
    (acc: number, day: MenuDay) => acc + day.locations.length,
    0,
  );

  $effect(updateTotals);

  function updateTotals() {
    totalPhotos = authors.reduce(sumAuthorCounts, 0);
    totalAuthors = authors.length;
  }

  function sumAuthorCounts(sum: number, author: AuthorStats): number {
    return sum + author.count;
  }

  // visiblePhotos and totalLocations are derived stores — read them with $visiblePhotos / $totalLocations in template

  // compute total unique locations across manifest
  // total unique locations is set above in the same computeTotals effect

  function getAuthorSlug(a: AuthorStats) {
    return a.slug ?? toSlug(a.name);
  }

  /**
   * Toggles an author's selection status.
   * Implements subtractive logic: empty selection equals "all selected".
   */
  function toggleAuthor(slug: string, displayName?: string) {
    const previous = $selectedAuthors;
    if (getStore(debug)) {
      console.debug("filters: toggleAuthor start", {
        slug,
        name: displayName,
        previous,
      });
    }

    selectedAuthors.update(function updateSelection(current) {
      let effectiveCurrent = current;

      // Resolve "All" or "None" states to concrete list
      if (current.length === 0) {
        effectiveCurrent = authors.map(getAuthorSlug);
      } else if (current.includes("none")) {
        effectiveCurrent = [];
      }

      const isSelected = effectiveCurrent.includes(slug);
      let next: string[];

      if (isSelected) {
        // Deselecting one author
        next = effectiveCurrent.filter(function excludeSlug(s) {
          return s !== slug;
        });
      } else {
        // Selecting one author
        next = [...effectiveCurrent, slug];
      }

      // 2. Resolve final state to store
      const allSlugs = authors.map(getAuthorSlug);

      if (next.length === 0) {
        // User deselected everyone -> explicitly "none" to hide all
        return ["none"];
      }

      if (next.length === allSlugs.length) {
        // User selected everyone again -> reset to empty [] (implicit all)
        return [];
      }

      return next;
    });
  }

  // Event handler factories
  function createToggleHandler(slug: string, name: string) {
    return function handleToggle() {
      toggleAuthor(slug, name);
    };
  }

  function stopPropagation(e: Event) {
    e.stopPropagation();
  }
</script>

<Offcanvas.Root>
  <Offcanvas.Trigger
    class={buttonVariants({
      size: "icon",
      variant: "ghost",
    })}
    aria-label="Otevřít filtry"
    title="Otevřít filtry"
    data-testid="filters-offcanvas-trigger"
  >
    <SlidersHorizontal strokeWidth={2.5} />
  </Offcanvas.Trigger>

  <Offcanvas.Content
    side="right"
    className="overflow-y-auto text-foreground dark:bg-slate-900"
    data-testid="filters-offcanvas"
  >
    <div class="py-4 px-6 border-b">
      <h2 class="text-md font-semibold">Filtry</h2>
    </div>

    <div
      class="relative px-6 py-4 border-b grid grid-cols-3 gap-4 text-center text-sm text-slate-400 bg-slate-100 dark:bg-slate-950"
      data-testid="filters-stats"
    >
      <div>
        <div
          class="font-semibold text-foreground text-lg tracking-tight"
          data-testid="filters-stats-photos"
        >
          {#if totalPhotos > 0}
            {totalPhotos}
            <span class="text-slate-300">/</span>
          {/if}
          {$visiblePhotos}
        </div>
        <div class="text-xs text-slate-500">
          Fotky{#if totalPhotos > 0}
            / zobrazeno{/if}
        </div>
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
        <p class="text-sm font-semibold">Zobrazit popisky</p>
        <p class="text-xs text-slate-400">Zobrazí popisky u fotek</p>
      </div>
      <Switch
        bind:checked={$showPhotoLabels}
        aria-label={$showPhotoLabels ? "Skrýt popisky" : "Zobrazit popisky"}
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

    {#if authors.length > 0}
      <div class="px-6 py-4 border-b space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">Autoři</p>
        </div>
        <div class="flex flex-col gap-3">
          {#each authors as author (author.name)}
            {@const slugKey = author.slug ?? toSlug(author.name)}
            {@const isActive =
              $selectedAuthors.length === 0 ||
              ($selectedAuthors.includes(slugKey) &&
                !$selectedAuthors.includes("none"))}
            {@const testIdKey = slugKey}
            <div
              class={`flex items-center justify-between text-sm ${
                isActive ? "text-primary" : "text-slate-100"
              }`}
              data-testid={`filters-author-${testIdKey}`}
              role="button"
              tabindex="0"
              onclick={createToggleHandler(slugKey, author.name)}
              onkeydown={function handleKeydown(event) {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  toggleAuthor(slugKey, author.name);
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
                onclick={stopPropagation}
                onkeydown={stopPropagation}
              >
                <Switch
                  checked={isActive}
                  aria-label={isActive
                    ? `Vypnout filtr ${author.name}`
                    : `Zapnout filtr ${author.name}`}
                  data-testid={`filters-author-switch-${testIdKey}`}
                  onCheckedChange={createToggleHandler(slugKey, author.name)}
                />
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="px-6 py-4 border-b flex items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold">Vzhled</p>
        <!-- <p class="text-xs text-slate-400">Přepnout tmavý režim</p> -->
      </div>
      <div class="flex items-center border border-border rounded-lg p-1 gap-1">
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-all hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800 {mode?.current ===
          'light'
            ? 'bg-slate-200 text-foreground shadow-sm dark:bg-slate-700'
            : 'text-slate-400'}"
          onclick={() => setMode("light")}
          aria-label="Světlý režim"
        >
          <Sun class="h-4 w-4" />
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-all hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800 text-slate-400"
          onclick={() => resetMode()}
          aria-label="Systémový režim"
        >
          <Monitor class="h-4 w-4" />
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-all hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800 {mode?.current ===
          'dark'
            ? 'bg-slate-200 text-foreground shadow-sm dark:bg-slate-700'
            : 'text-slate-400'}"
          onclick={() => setMode("dark")}
          aria-label="Tmavý režim"
        >
          <Moon class="h-4 w-4" />
        </button>
      </div>
    </div>
  </Offcanvas.Content>
</Offcanvas.Root>

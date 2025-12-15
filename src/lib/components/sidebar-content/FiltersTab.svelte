<script lang="ts">
  import { showPhotoLabels } from "$lib/stores/photoLabels";
  import { selectedAuthors, showSeparators, visiblePhotos } from "$lib/stores/filters";
  import { Switch } from "$lib/components/ui/switch";
  import { Badge } from "$lib/components/ui/badge/";
  import { Sun, Moon, Monitor } from "lucide-svelte";
  import { setMode, resetMode, mode } from "mode-watcher";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";
  import { toSlug } from "$lib/utils/strings";
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

  function getAuthorSlug(a: AuthorStats) {
    return a.slug ?? toSlug(a.name);
  }

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

      if (current.length === 0) {
        effectiveCurrent = authors.map(getAuthorSlug);
      } else if (current.includes("none")) {
        effectiveCurrent = [];
      }

      const isSelected = effectiveCurrent.includes(slug);
      let next: string[];

      if (isSelected) {
        next = effectiveCurrent.filter((s) => s !== slug);
      } else {
        next = [...effectiveCurrent, slug];
      }

      const allSlugs = authors.map(getAuthorSlug);

      if (next.length === 0) {
        return ["none"];
      }

      if (next.length === allSlugs.length) {
        return [];
      }

      return next;
    });
  }

  function createToggleHandler(slug: string, name: string) {
    return function handleToggle() {
      toggleAuthor(slug, name);
    };
  }

  function stopPropagation(e: Event) {
    e.stopPropagation();
  }
</script>

<div class="contents" data-testid="filters-tab">
  <Sidebar.Content>
    <div
      class="relative px-6 py-4 border-b grid grid-cols-3 gap-4 text-center text-sm text-slate-400 bg-slate-100 dark:bg-slate-950"
      data-testid="filters-tab-stats"
    >
      <div>
        <div
          class="font-semibold text-foreground text-lg tracking-tight"
          data-testid="filters-tab-stats-photos"
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
          data-testid="filters-tab-stats-authors"
        >
          {totalAuthors}
        </div>
        <div class="text-xs text-slate-500">Autoři</div>
      </div>

      <div>
        <div
          class="font-semibold text-foreground text-lg tracking-tight"
          data-testid="filters-tab-stats-stops"
        >
          {totalLocations}
        </div>
        <div class="text-xs text-slate-500">Zastávek</div>
      </div>
    </div>
    <label
      class="px-6 py-4 border-b flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
      data-testid="filters-tab-location-control"
    >
      <div>
        <p class="text-sm font-semibold">Zobrazit popisky</p>
        <p class="text-xs text-slate-400">Zobrazí popisky u fotek</p>
      </div>
      <Switch
        bind:checked={$showPhotoLabels}
        aria-label={$showPhotoLabels ? "Skrýt popisky" : "Zobrazit popisky"}
        data-testid="filters-tab-location-switch"
      />
    </label>
    <label
      class="px-6 py-4 border-b flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
      data-testid="filters-tab-separators-control"
    >
      <div>
        <p class="text-sm font-semibold">Zobrazit zastávky</p>
        <p class="text-xs text-slate-400">Popisky zastávek na cestě</p>
      </div>
      <Switch
        bind:checked={$showSeparators}
        aria-label={$showSeparators ? "Skrýt zastávky" : "Zobrazit zastávky"}
        data-testid="filters-tab-separators-switch"
      />
    </label>

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
              ($selectedAuthors.includes(slugKey) && !$selectedAuthors.includes("none"))}
            {@const testIdKey = slugKey}
            <label
              class={`flex items-center justify-between text-sm cursor-pointer ${
                isActive ? "text-primary" : "text-slate-100"
              }`}
              data-testid={`filters-tab-author-${testIdKey}`}
            >
              <span class="flex items-center gap-2">
                <span>{author.name}</span>
                <Badge variant="outline">{author.count}</Badge>
              </span>
              <Switch
                checked={isActive}
                aria-label={isActive
                  ? `Vypnout filtr ${author.name}`
                  : `Zapnout filtr ${author.name}`}
                data-testid={`filters-tab-author-switch-${testIdKey}`}
                onCheckedChange={createToggleHandler(slugKey, author.name)}
              />
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </Sidebar.Content>

  <Sidebar.Footer class="border-t border-sidebar-border bg-sidebar p-4 px-6">
    <div class="flex items-center justify-between gap-4">
      <div class="text-sm font-semibold">Vzhled</div>
      <div class="flex items-center">
        <ToggleGroup
          type="single"
          value={mode?.current ?? "system"}
          onValueChange={(v) => {
            if (!v) return;
            if (v === "system") {
              resetMode();
            } else {
              setMode(v as "light" | "dark");
            }
          }}
          class="gap-1 border border-border rounded-lg p-1"
        >
          <ToggleGroupItem
            value="light"
            aria-label="Světlý režim"
            class="h-7 w-7 data-[state=on]:bg-slate-200 dark:data-[state=on]:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Sun class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="system"
            aria-label="Systémový režim"
            class="h-7 w-7 data-[state=on]:bg-slate-200 dark:data-[state=on]:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Monitor class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            aria-label="Tmavý režim"
            class="h-7 w-7 data-[state=on]:bg-slate-200 dark:data-[state=on]:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Moon class="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  </Sidebar.Footer>
</div>

<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Switch } from "$lib/components/ui/switch";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";
  import { debug } from "$lib/stores/debug";
  import { selectedAuthors, showSeparators, visiblePhotos } from "$lib/stores/filters";
  import { showPhotoLabels } from "$lib/stores/photoLabels";
  import type { MenuDay } from "$lib/types/manifest";
  import { getMenuItems } from "$lib/utils/menu";
  import { toSlug } from "$lib/utils/strings";
  import Monitor from "lucide-svelte/icons/monitor";
  import Moon from "lucide-svelte/icons/moon";
  import Sun from "lucide-svelte/icons/sun";
  import { mode, resetMode, setMode } from "mode-watcher";
  import { get as getStore } from "svelte/store";

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
      class="relative grid grid-cols-3 gap-4 border-b bg-slate-100 px-6 py-4 text-center text-sm text-slate-400 dark:bg-slate-950"
      data-testid="filters-tab-stats"
    >
      <div>
        <div
          class="text-foreground text-lg font-semibold tracking-tight"
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
          class="text-foreground text-lg font-semibold tracking-tight"
          data-testid="filters-tab-stats-authors"
        >
          {totalAuthors}
        </div>
        <div class="text-xs text-slate-500">Autoři</div>
      </div>

      <div>
        <div
          class="text-foreground text-lg font-semibold tracking-tight"
          data-testid="filters-tab-stats-stops"
        >
          {totalLocations}
        </div>
        <div class="text-xs text-slate-500">Zastávek</div>
      </div>
    </div>
    <label
      class="flex cursor-pointer items-center justify-between gap-4 border-b px-6 py-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
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
      class="flex cursor-pointer items-center justify-between gap-4 border-b px-6 py-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
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
      <div class="space-y-3 border-b px-6 py-4">
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
              class={`flex cursor-pointer items-center justify-between text-sm ${
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

  <Sidebar.Footer class="border-sidebar-border bg-sidebar border-t p-4 px-6">
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
          class="border-border gap-1 rounded-lg border p-1"
        >
          <ToggleGroupItem
            value="light"
            aria-label="Světlý režim"
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
          >
            <Sun class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="system"
            aria-label="Systémový režim"
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
          >
            <Monitor class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            aria-label="Tmavý režim"
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
          >
            <Moon class="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  </Sidebar.Footer>
</div>

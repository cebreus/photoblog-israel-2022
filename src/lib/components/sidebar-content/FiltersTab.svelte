<script lang="ts">
  import { filters } from "$lib/stores/filters.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { MenuDay, QualityBucket } from "$lib/types/manifest";
  import { getMenuItems } from "$lib/utils/menu";
  import { toSlug } from "$lib/utils/strings";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let { authors = [], qualityStats = new Map() } = $props<{
    authors?: AuthorStats[];
    qualityStats?: Map<string, number>;
  }>();

  let _totalPhotos = $state(0);
  let _totalAuthors = $state(0);
  const _totalLocations = getMenuItems().reduce(
    (acc: number, day: MenuDay) => acc + day.locations.length,
    0,
  );

  $effect(updateTotals);

  function updateTotals() {
    _totalPhotos = authors.reduce(sumAuthorCounts, 0);
    _totalAuthors = authors.length;
  }

  function sumAuthorCounts(sum: number, author: AuthorStats): number {
    return sum + author.count;
  }

  function getAuthorSlug(a: AuthorStats) {
    return a.slug ?? toSlug(a.name);
  }

  function toggleAuthor(slug: string, _displayName?: string) {
    const _previous = filters.selectedAuthors;
    if (ui.debugMode) {
    }

    let effectiveCurrent = filters.selectedAuthors;

    if (filters.selectedAuthors.length === 0) {
      effectiveCurrent = authors.map(getAuthorSlug);
    } else if (filters.selectedAuthors.includes("none")) {
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
      filters.selectedAuthors = ["none"];
      return;
    }

    if (next.length === allSlugs.length) {
      filters.selectedAuthors = [];
      return;
    }

    filters.selectedAuthors = next;
  }

  function _toggleQualityBucket(bucketId: string) {
    // Cast to QualityBucket as we know the input comes from QUALITY_BUCKETS list
    const id = bucketId as QualityBucket;
    if (filters.selectedQualityBuckets.includes(id)) {
      filters.selectedQualityBuckets = filters.selectedQualityBuckets.filter((i) => i !== id);
    } else {
      filters.selectedQualityBuckets = [...filters.selectedQualityBuckets, id];
    }
  }

  function _createToggleHandler(slug: string, name: string) {
    return function handleToggle() {
      toggleAuthor(slug, name);
    };
  }

  const _qualityCount = $derived(
    Array.from(qualityStats.values() as IterableIterator<number>).reduce(
      (sum: number, val: number) => sum + val,
      0,
    ),
  );
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
          {filters.visiblePhotos}
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
        bind:checked={ui.photoLabels}
        aria-label={ui.photoLabels ? "Skrýt popisky" : "Zobrazit popisky"}
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
        bind:checked={filters.showSeparators}
        aria-label={filters.showSeparators ? "Skrýt zastávky" : "Zobrazit zastávky"}
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
              filters.selectedAuthors.length === 0 ||
              (filters.selectedAuthors.includes(slugKey) &&
                !filters.selectedAuthors.includes("none"))}
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

    {#if qualityStats.size > 0 && qualityCount > 0}
      <div class="space-y-3 border-b px-6 py-4">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold">Kvalita fotek</p>
        </div>
        <div class="flex flex-col gap-3">
          {#each QUALITY_BUCKETS as bucket (bucket.id)}
            {@const count = qualityStats.get(bucket.id) ?? 0}
            {@const isActive = filters.selectedQualityBuckets.includes(bucket.id)}
            <label
              class={`flex cursor-pointer items-center justify-between text-sm ${
                isActive ? "text-primary" : "text-slate-100"
              }`}
              data-testid={`filters-tab-quality-${bucket.id}`}
            >
              <span class="flex items-center gap-2">
                <span>{bucket.label}</span>
                <Badge variant="outline">{count}</Badge>
              </span>
              <Switch
                checked={isActive}
                aria-label={isActive
                  ? `Vypnout filtr ${bucket.label}`
                  : `Zapnout filtr ${bucket.label}`}
                onCheckedChange={() => toggleQualityBucket(bucket.id)}
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

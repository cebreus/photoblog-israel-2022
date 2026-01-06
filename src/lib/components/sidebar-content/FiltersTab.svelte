<script lang="ts">
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { mode, resetMode, setMode } from "mode-watcher";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge/";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Switch } from "$lib/components/ui/switch";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";
  import { createLogger } from "$lib/logger";
  import { filters, MEDIA_TYPES } from "$lib/stores/filters.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { MediaItemType, QualityFilterBucket } from "$lib/types/manifest";
  import { QUALITY_BUCKETS } from "$lib/utils/gallery";
  import { getMenuItems } from "$lib/utils/menu";
  import { toSlug } from "$lib/utils/strings";

  const logger = createLogger("FiltersTab");

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let { authors = [], qualityStats = new Map() } = $props<{
    authors?: AuthorStats[];
    qualityStats?: Map<string, number>;
  }>();

  let totalPhotos = $state(0);
  let totalAuthors = $state(0);
  const totalLocations = getMenuItems().reduce((acc: number, day) => acc + day.locations.length, 0);

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

  function isAuthorActive(slug: string): boolean {
    if (filters.selectedAuthors.length === 0) return true;
    return filters.selectedAuthors.includes(slug) && !filters.selectedAuthors.includes("none");
  }

  function toggleAuthor(slug: string, displayName?: string) {
    const previous = filters.selectedAuthors;
    if (ui.debugMode) {
      logger.debug({ slug, name: displayName, previous }, "filters: toggleAuthor start");
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

  function isQualityActive(bucketId: QualityFilterBucket): boolean {
    if (filters.selectedQualityBuckets.length === 0) return true;
    // We check for "none" explicitly, though strictly typed array shouldn't have it mixed ideally.
    // However, our logic uses "none" as a special marker in the same array sometimes (legacy/URL param logic).
    // Safe check:
    return (
      filters.selectedQualityBuckets.includes(bucketId) &&
      !filters.selectedQualityBuckets.includes("none" as QualityFilterBucket)
    );
  }

  function toggleQualityBucket(id: QualityFilterBucket) {
    let current = filters.selectedQualityBuckets;

    if (current.includes("none" as QualityFilterBucket)) {
      current = [];
    } else if (current.length === 0) {
      current = QUALITY_BUCKETS.map((b) => b.id);
    }

    if (current.includes(id)) {
      current = current.filter((i) => i !== id);
    } else {
      current = [...current, id];
    }

    if (current.length === 0) {
      filters.selectedQualityBuckets = ["none" as QualityFilterBucket];
    } else if (current.length === QUALITY_BUCKETS.length) {
      filters.selectedQualityBuckets = [];
    } else {
      filters.selectedQualityBuckets = current;
    }
  }

  function isMediaTypeActive(typeId: MediaItemType): boolean {
    if (filters.selectedMediaTypes.length === 0) return true;
    return (
      filters.selectedMediaTypes.includes(typeId) &&
      !filters.selectedMediaTypes.includes("none" as MediaItemType)
    );
  }

  function handleMediaTypeToggle(typeId: MediaItemType, checked: boolean) {
    let current = filters.selectedMediaTypes;
    // Handle special "none" case
    if (current.includes("none" as MediaItemType)) {
      current = [];
    } else if (current.length === 0) {
      current = MEDIA_TYPES.map((t) => t.id);
    }

    if (checked) {
      current = [...current, typeId];
    } else {
      current = current.filter((id) => id !== typeId);
    }

    if (current.length === 0) {
      filters.selectedMediaTypes = ["none" as MediaItemType];
    } else if (current.length === MEDIA_TYPES.length) {
      filters.selectedMediaTypes = [];
    } else {
      filters.selectedMediaTypes = current;
    }
  }

  function handleModeChange(v: string | undefined) {
    if (!v) return;
    if (v === "system") {
      resetMode();
    } else {
      setMode(v as "light" | "dark");
    }
  }

  function createToggleHandler(slug: string, name: string) {
    return function handleToggle() {
      toggleAuthor(slug, name);
    };
  }

  function createQualityToggleHandler(id: QualityFilterBucket) {
    return function handleToggle() {
      toggleQualityBucket(id);
    };
  }

  const qualityCount = $derived(
    (Array.from(qualityStats.values()) as number[]).reduce((sum, val) => sum + val, 0),
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
            {@const isActive = isAuthorActive(slugKey)}
            <label
              class={`flex cursor-pointer items-center justify-between text-sm ${
                isActive ? "text-primary" : "text-slate-100"
              }`}
              data-testid={`filters-tab-author-${slugKey}`}
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
                data-testid={`filters-tab-author-switch-${slugKey}`}
                onCheckedChange={createToggleHandler(slugKey, author.name)}
              />
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Media Types Section -->
    <div class="space-y-3 border-b px-6 py-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold">Typ média</p>
      </div>
      <div class="grid gap-2">
        {#each MEDIA_TYPES as type}
          {@const isChecked = isMediaTypeActive(type.id)}
          <label
            class={`flex cursor-pointer items-center justify-between text-sm ${
              isChecked ? "text-primary" : "text-slate-100"
            }`}
          >
            <span>{type.label}</span>
            <Switch
              checked={isChecked}
              onCheckedChange={(c) => handleMediaTypeToggle(type.id, c)}
              aria-label={`Filtr ${type.label}`}
            />
          </label>
        {/each}
      </div>
      <p class="pt-1 text-xs text-slate-400">Pokud není vybrán žádný typ, nezobrazí se nic.</p>
    </div>

    <!-- Collapsible Sections (Snapshots & Quality) -->
    <div class="px-6 pb-2">
      <Accordion.Root type="multiple" class="w-full">
        <!-- Snapshots Section -->
        <Accordion.Item value="snapshots" class="border-b-0">
          <Accordion.Trigger class="py-3 hover:no-underline">
            <span class="text-sm font-semibold">Momentky</span>
          </Accordion.Trigger>
          <Accordion.Content>
            <div class="flex flex-col gap-3 pb-4">
              <label
                class={`flex cursor-pointer items-center justify-between text-sm ${
                  filters.onlySnapshots ? "text-primary" : "text-slate-100"
                }`}
                data-testid="filters-tab-only-snapshots-control"
              >
                <span><b>Pouze momentky</b></span>
                <Switch
                  bind:checked={filters.onlySnapshots}
                  aria-label={filters.onlySnapshots
                    ? "Zobrazit všechny fotky"
                    : "Zobrazit pouze momentky"}
                  data-testid="filters-tab-only-snapshots-switch"
                />
              </label>

              <label
                class={`flex cursor-pointer items-center justify-between text-sm ${
                  filters.showAuthorSnapshots ? "text-primary" : "text-slate-100"
                }`}
                data-testid="filters-tab-author-snapshots-control"
              >
                <span>Zobrazit momentky autora</span>
                <Switch
                  bind:checked={filters.showAuthorSnapshots}
                  aria-label={filters.showAuthorSnapshots
                    ? "Skrýt momentky autora"
                    : "Zobrazit momentky autora"}
                  data-testid="filters-tab-author-snapshots-switch"
                />
              </label>

              <label
                class={`flex cursor-pointer items-center justify-between text-sm ${
                  filters.showOthersSnapshots ? "text-primary" : "text-slate-100"
                }`}
                data-testid="filters-tab-others-snapshots-control"
              >
                <span>Zobrazit další momentky</span>
                <Switch
                  bind:checked={filters.showOthersSnapshots}
                  aria-label={filters.showOthersSnapshots
                    ? "Skrýt další momentky"
                    : "Zobrazit další momentky"}
                  data-testid="filters-tab-others-snapshots-switch"
                />
              </label>

              <p class="pt-1 text-xs text-slate-400">
                Momentky jsou soukromé snímky a nemají obecnou dokumentární hodnotu.
              </p>
            </div>
          </Accordion.Content>
        </Accordion.Item>

        <!-- Quality Section -->
        {#if qualityStats.size > 0 && qualityCount > 0}
          <Accordion.Item value="quality" class="border-t border-b-0">
            <Accordion.Trigger class="py-3 hover:no-underline">
              <span class="text-sm font-semibold">Kvalita fotek</span>
            </Accordion.Trigger>
            <Accordion.Content>
              <div class="flex flex-col gap-3 pb-4">
                {#each QUALITY_BUCKETS as bucket (bucket.id)}
                  {@const count = qualityStats.get(bucket.id) ?? 0}
                  {@const isActive = isQualityActive(bucket.id)}
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
                      onCheckedChange={createQualityToggleHandler(bucket.id)}
                    />
                  </label>
                {/each}
                <p class="pt-1 text-xs text-slate-400">
                  Pokud není vybrána žádná kvalita, nezobrazí se nic.
                  <br />

                  Kvalita je určena automaticky pomocí AI (estetika) a technické analýzy (ostrost).
                  Pomáhá skrýt slabší snímky, které jsou ale ponechány pro dokumentární účely.
                </p>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        {/if}
      </Accordion.Root>
    </div>
  </Sidebar.Content>

  <Sidebar.Footer class="border-sidebar-border bg-sidebar border-t p-4 px-6">
    <div class="flex items-center justify-between gap-4">
      <div class="text-sm font-semibold">Vzhled</div>
      <div class="flex items-center">
        <ToggleGroup
          type="single"
          value={mode?.current ?? "system"}
          onValueChange={handleModeChange}
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

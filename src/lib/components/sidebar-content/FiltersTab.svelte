<script lang="ts">
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { mode, resetMode, setMode } from "mode-watcher";

  import * as Accordion from "$lib/components/ui/accordion";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Switch } from "$lib/components/ui/switch";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";
  import { filters } from "$lib/stores/filters.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import { getMenuItems } from "$lib/utils/menu";

  import AuthorsFilter from "./filters/AuthorsFilter.svelte";
  import MediaTypesFilter from "./filters/MediaTypesFilter.svelte";
  import PeopleFilter from "./filters/PeopleFilter.svelte";
  import QualityFilter from "./filters/QualityFilter.svelte";
  import SnapshotsFilter from "./filters/SnapshotsFilter.svelte";

  import FiltersStats from "./FiltersStats.svelte";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let {
    authors = [],
    qualityStats = new Map(),
    mediaStats = new Map(),
    snapshotStats = { total: 0, author: 0, others: 0 },
  } = $props<{
    authors?: AuthorStats[];
    qualityStats?: Map<string, number>;
    mediaStats?: Map<string, number>;
    snapshotStats?: { total: number; author: number; others: number };
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

  function handleModeChange(v: string | undefined) {
    if (!v) return;
    if (v === "system") {
      resetMode();
    } else {
      setMode(v as "light" | "dark");
    }
  }

  const qualityCount = $derived(
    (Array.from(qualityStats.values()) as number[]).reduce((sum, val) => sum + val, 0),
  );

  $effect(() => {
    filters.initPersistence();
  });
</script>

<div class="contents" data-testid="filters-tab">
  <Sidebar.Content class="gap-y-0">
    <FiltersStats {totalPhotos} {totalAuthors} {totalLocations} />

    <label
      class="flex cursor-pointer items-center justify-between gap-4 border-b px-6 py-3"
      data-testid="filters-tab-location-control"
    >
      <div class="text-sm font-semibold">
        Zobrazit popisky
        <p class="text-xs text-slate-400">Zobrazí popisky u fotek</p>
      </div>
      <Switch
        bind:checked={ui.photoLabels}
        aria-label={ui.photoLabels ? "Skrýt popisky" : "Zobrazit popisky"}
        data-testid="filters-tab-location-switch"
      />
    </label>

    <label
      class="flex cursor-pointer items-center justify-between gap-4 border-b px-6 py-3"
      data-testid="filters-tab-separators-control"
    >
      <div class="text-sm font-semibold">
        Zobrazit zastávky
        <p class="text-xs text-slate-400">Popisky zastávek na cestě</p>
      </div>
      <Switch
        bind:checked={filters.showSeparators}
        aria-label={filters.showSeparators ? "Skrýt zastávky" : "Zobrazit zastávky"}
        data-testid="filters-tab-separators-switch"
      />
    </label>

    <Accordion.Root
      type="multiple"
      bind:value={filters.accordionValue}
      data-testid="filters-accordion"
    >
      <PeopleFilter />

      <AuthorsFilter {authors} />

      <MediaTypesFilter {mediaStats} />

      <SnapshotsFilter {snapshotStats} />

      <QualityFilter {qualityStats} {qualityCount} />
    </Accordion.Root>
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
          data-testid="theme-toggle-group"
        >
          <ToggleGroupItem
            value="light"
            aria-label="Světlý režim"
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
            data-testid="theme-toggle-light"
          >
            <Sun class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="system"
            aria-label="Systémový režim"
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
            data-testid="theme-toggle-system"
          >
            <Monitor class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            aria-label="Tmavý režim"
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
            data-testid="theme-toggle-dark"
          >
            <Moon class="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  </Sidebar.Footer>
</div>

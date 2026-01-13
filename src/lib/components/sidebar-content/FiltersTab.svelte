<script lang="ts">
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { mode, resetMode, setMode } from "mode-watcher";

  import * as Accordion from "$lib/components/ui/accordion";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Switch } from "$lib/components/ui/switch";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";
  import * as m from "$lib/paraglide/messages";
  import { filters } from "$lib/stores/filters.svelte";
  import { people } from "$lib/stores/people.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { Person } from "$lib/types/manifest";
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

  const totalPeople = $derived(people.displayPersons.filter((p: Person) => p.isUserNamed).length);

  $effect(() => {
    filters.initPersistence();
  });
</script>

<div class="contents" data-testid="filters-tab">
  <Sidebar.Content class="gap-y-0">
    <FiltersStats {totalPhotos} {totalAuthors} {totalPeople} {totalLocations} />

    <label
      class="flex cursor-pointer items-center justify-between gap-4 border-b px-6 py-3"
      data-testid="filters-tab-location-control"
    >
      <div class="text-sm font-semibold">
        {m.ui_show_labels()}
        <p class="text-xs text-slate-400">{m.ui_show_labels_description()}</p>
      </div>
      <Switch
        bind:checked={ui.photoLabels}
        aria-label={ui.photoLabels ? m.ui_hide_labels_aria() : m.ui_show_labels()}
        data-testid="filters-tab-location-switch"
      />
    </label>

    <label
      class="flex cursor-pointer items-center justify-between gap-4 border-b px-6 py-3"
      data-testid="filters-tab-separators-control"
    >
      <div class="text-sm font-semibold">
        {m.ui_show_stops()}
        <p class="text-xs text-slate-400">{m.ui_show_stops_description()}</p>
      </div>
      <Switch
        bind:checked={filters.showSeparators}
        aria-label={filters.showSeparators ? m.ui_hide_stops_aria() : m.ui_show_stops()}
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
      <div class="text-sm font-semibold">{m.ui_appearance()}</div>
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
            aria-label={m.ui_theme_light()}
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
            data-testid="theme-toggle-light"
          >
            <Sun class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="system"
            aria-label={m.ui_theme_system()}
            class="h-7 w-7 hover:bg-slate-100 data-[state=on]:bg-slate-200 dark:hover:bg-slate-800 dark:data-[state=on]:bg-slate-700"
            data-testid="theme-toggle-system"
          >
            <Monitor class="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            aria-label={m.ui_theme_dark()}
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

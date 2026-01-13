<script lang="ts">
  import { filters } from "$lib/stores/filters.svelte";
  import { getPlural } from "$lib/utils/i18n";

  let { totalPhotos, totalAuthors, totalPeople, totalLocations } = $props<{
    totalPhotos: number;
    totalAuthors: number;
    totalPeople: number;
    totalLocations: number;
  }>();
</script>

<div
  class="relative mb-2 grid grid-cols-3 gap-2 border-b bg-slate-100 px-4 py-3 text-center text-sm text-slate-400 dark:bg-slate-950"
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
    <div class="text-xs text-slate-500 capitalize">
      {getPlural(totalPhotos, "fotka")}
    </div>
  </div>

  <div>
    <div
      class="text-foreground text-lg font-semibold tracking-tight"
      data-testid="filters-tab-stats-authors"
    >
      {totalAuthors} / {totalPeople}
    </div>
    <div class="text-xs text-slate-500 capitalize">
      {getPlural(totalAuthors, "autor")} / {getPlural(totalPeople, "osoba")}
    </div>
  </div>

  <div>
    <div
      class="text-foreground text-lg font-semibold tracking-tight"
      data-testid="filters-tab-stats-stops"
    >
      {totalLocations}
    </div>
    <div class="text-xs text-slate-500 capitalize">
      {getPlural(totalLocations, "zastavka")}
    </div>
  </div>
</div>

<script lang="ts">
  import { filters } from "$lib/stores/filters.svelte";

  let { totalPhotos, totalAuthors, totalLocations } = $props<{
    totalPhotos: number;
    totalAuthors: number;
    totalLocations: number;
  }>();
</script>

<div
  class="relative mb-2 grid grid-cols-3 gap-4 border-b bg-slate-100 px-6 py-3 text-center text-sm text-slate-400 dark:bg-slate-950"
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

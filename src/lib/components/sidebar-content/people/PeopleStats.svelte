<script lang="ts">
  import { PLURALS } from "$lib/utils/messages";

  type Stats = {
    total: number;
    named: number;
    faces: number;
    totalWithFaces: number;
    visibleWithFaces: number;
  };

  let { stats }: { stats: Stats } = $props();
</script>

<div
  class="relative grid grid-cols-3 gap-4 border-b bg-slate-100 px-6 py-4 text-center text-sm text-slate-400 dark:bg-slate-950"
  data-testid="people-tab-stats"
>
  <div>
    <div
      class="text-foreground text-lg font-semibold tracking-tight"
      data-testid="people-tab-stats-identified"
    >
      {stats.totalWithFaces}
      <span class="text-slate-300">/</span>
      {stats.visibleWithFaces}
    </div>
    <div class="text-xs text-slate-500">
      Fotky{#if stats.totalWithFaces > 0}
        / zobrazeno{/if}
    </div>
  </div>

  <div>
    <div
      class="text-foreground text-lg font-semibold tracking-tight"
      data-testid="people-tab-stats-people"
    >
      {stats.total}
    </div>
    <div class="text-xs text-slate-500 capitalize">{PLURALS.osoba(stats.total)}</div>
  </div>

  <div>
    <div
      class="text-foreground text-lg font-semibold tracking-tight"
      data-testid="people-tab-stats-faces"
    >
      {stats.faces}
    </div>
    <div class="text-xs text-slate-500 capitalize">{PLURALS.tvar(stats.faces)}</div>
  </div>
</div>

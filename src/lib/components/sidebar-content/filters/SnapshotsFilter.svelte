<script lang="ts">
  import { Eye, EyeOff } from "@lucide/svelte";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge/";
  import { Button } from "$lib/components/ui/button/";
  import { filters } from "$lib/stores/filters.svelte";

  let { snapshotStats = { total: 0, author: 0, others: 0 } } = $props<{
    snapshotStats: { total: number; author: number; others: number };
  }>();

  let isOnlySnapshotsActive = $derived(filters.onlySnapshots);
  let isAuthorSnapshotsActive = $derived(filters.showAuthorSnapshots);
  let isOthersSnapshotsActive = $derived(filters.showOthersSnapshots);

  let isAllHidden = $derived(!isAuthorSnapshotsActive && !isOthersSnapshotsActive);
  let isAllVisible = $derived(
    isAuthorSnapshotsActive && isOthersSnapshotsActive && !isOnlySnapshotsActive,
  );
</script>

{#if snapshotStats.total > 0}
  <Accordion.Item
    value="snapshots"
    class="px-6 py-1"
    data-testid="filters-accordion-item-snapshots"
  >
    <Accordion.Trigger
      class="py-3 hover:no-underline"
      data-testid="filters-accordion-trigger-snapshots"
    >
      Momentky
    </Accordion.Trigger>

    <Accordion.Content>
      <div
        class="mb-2 flex w-full justify-between gap-x-2"
        data-testid="filters-tab-snapshots-control"
      >
        <Button
          variant="outline"
          size="sm"
          title="Skrýt všechny momentky"
          class="h-7 px-3 text-xs"
          disabled={isAllHidden}
          onclick={(e) => {
            e.stopPropagation();
            filters.showAuthorSnapshots = false;
            filters.showOthersSnapshots = false;
            filters.onlySnapshots = false;
          }}
          data-testid="filter-snapshots-hide-all"
        >
          Bez momentek
        </Button>

        <Button
          variant={isAllVisible ? "outline" : "default"}
          size="sm"
          class="ml-auto h-7 px-3 text-xs"
          disabled={isAllVisible}
          onclick={(e) => {
            e.stopPropagation();
            // "S momentkami" enables all snapshots and disables "only snapshots" restriction
            filters.showAuthorSnapshots = true;
            filters.showOthersSnapshots = true;
            filters.onlySnapshots = false;
          }}
          title="Zobrazit všechno s momentkami"
          data-testid="filter-snapshots-show-all"
        >
          Všechno
        </Button>
      </div>

      <div
        class="group flex h-9 items-center justify-between"
        data-testid="filter-row-author-snapshots"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span
            class={`truncate text-sm ${isAuthorSnapshotsActive && snapshotStats.author > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}
          >
            Momentky autora
          </span>
          <Badge
            variant="secondary"
            class="text-muted-foreground h-5 min-w-[1.5rem] justify-center px-1.5 text-[10px] font-normal"
          >
            {snapshotStats.author}
          </Badge>
        </div>

        <Button
          variant="link"
          size="sm"
          title="Zobrazit pouze momentky autora"
          class="text-xs"
          disabled={snapshotStats.author === 0}
          onclick={(e) => {
            e.stopPropagation();
            filters.onlySnapshots = true;
            filters.showAuthorSnapshots = true;
            filters.showOthersSnapshots = false;
          }}
          data-testid="filter-solo-author-snapshots"
        >
          Pouze
        </Button>

        <Button
          variant={isAuthorSnapshotsActive ? "outline" : "ghost"}
          size="icon"
          title={isAuthorSnapshotsActive ? "Skrýt" : "Zobrazit"}
          class="text-primary size-8"
          disabled={snapshotStats.author === 0}
          onclick={() => (filters.showAuthorSnapshots = !filters.showAuthorSnapshots)}
          data-testid="filter-visibility-author-snapshots"
        >
          {#if isAuthorSnapshotsActive}
            <Eye class="size-4" strokeWidth={2.5} />
          {:else}
            <EyeOff class="size-4" strokeWidth={2.5} />
          {/if}
        </Button>
      </div>

      <div
        class="group flex items-center justify-between"
        data-testid="filter-row-others-snapshots"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span
            class={`truncate text-sm ${isOthersSnapshotsActive && snapshotStats.others > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}
          >
            Další momentky
          </span>
          <Badge
            variant="secondary"
            class="text-muted-foreground h-5 min-w-[1.5rem] justify-center px-1.5 text-[10px] font-normal"
          >
            {snapshotStats.others}
          </Badge>
        </div>

        <Button
          variant="link"
          size="sm"
          title="Zobrazit pouze další momentky"
          class="text-xs"
          disabled={snapshotStats.others === 0}
          onclick={(e) => {
            e.stopPropagation();
            filters.onlySnapshots = true;
            filters.showAuthorSnapshots = false;
            filters.showOthersSnapshots = true;
          }}
          data-testid="filter-solo-others-snapshots"
        >
          Pouze
        </Button>

        <Button
          variant={isOthersSnapshotsActive ? "outline" : "ghost"}
          size="icon"
          title={isOthersSnapshotsActive ? "Skrýt" : "Zobrazit"}
          class="text-primary size-8"
          disabled={snapshotStats.others === 0}
          onclick={() => (filters.showOthersSnapshots = !filters.showOthersSnapshots)}
          data-testid="filter-visibility-others-snapshots"
        >
          {#if isOthersSnapshotsActive}
            <Eye class="size-4" strokeWidth={2.5} />
          {:else}
            <EyeOff class="size-4" strokeWidth={2.5} />
          {/if}
        </Button>
      </div>

      <p class="pt-1 text-xs text-slate-400">
        Momentky jsou soukromé snímky a nemají obecnou dokumentární hodnotu.
      </p>
    </Accordion.Content>
  </Accordion.Item>
{/if}

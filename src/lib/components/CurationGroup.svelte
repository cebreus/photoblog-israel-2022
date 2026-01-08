<script lang="ts">
  import PhotoGridItem from "$lib/components/PhotoGridItem.svelte";
  import type { CurationGroup, ImageEntry } from "$lib/types/manifest";
  import { cn } from "$lib/utils";

  let {
    group,
    items,
    class: className,
    onDelete,
    onArchive,
    onCopyMetadata,
    onSelect,
  } = $props<{
    group: CurationGroup;
    items: ImageEntry[];
    class?: string;
    onDelete?: (item: ImageEntry) => void;
    onArchive?: (item: ImageEntry) => void;
    onCopyMetadata?: (item: ImageEntry) => void;
    onSelect?: (item: ImageEntry, shiftKey: boolean) => void;
  }>();
</script>

<div
  class={cn(
    "col-span-full my-8 rounded-xl border bg-slate-100 p-4 shadow-inner dark:bg-yellow-900/50",
    className,
  )}
  data-testid="curation-group-{group.id}"
>
  <div
    class="mb-4 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800"
  >
    <h3 class="flex items-center gap-2 text-lg font-bold">
      <span class="text-amber-600 dark:text-amber-500">Řešení duplicit</span>
      <span
        class="text-muted-foreground rounded border bg-white px-2 py-0.5 font-mono text-xs dark:bg-slate-800"
      >
        {group.id.slice(0, 8)}
      </span>
    </h3>
    <div class="text-muted-foreground text-sm">
      Podobnost: {Math.round((group.similarity ?? 0) * 100)}%
    </div>
  </div>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {#each items as item (item.id)}
      <PhotoGridItem
        {item}
        mode="curation"
        curationGroup={group}
        {onDelete}
        {onArchive}
        {onCopyMetadata}
        {onSelect}
        loading="eager"
      />
    {/each}
  </div>
</div>

<script lang="ts">
  import type { CurationGroup, ImageEntry } from "$lib/types/manifest";

  let {
    group,
    items,
    class: className,
    onDelete,
    onArchive,
    onCopyMetadata,
    onPasteMetadata,
    onSelect,
  } = $props<{
    group: CurationGroup;
    items: ImageEntry[];
    class?: string;
    onDelete?: (item: ImageEntry) => void;
    onArchive?: (item: ImageEntry) => void;
    onCopyMetadata?: (item: ImageEntry) => void;
    onPasteMetadata?: (item: ImageEntry, onlyThis?: boolean) => void;
    onSelect?: (item: ImageEntry, shiftKey: boolean) => void;
  }>();
</script>

<div
  class={cn(
    "col-span-full bg-slate-100 dark:bg-yellow-900/50 border rounded-xl p-4 my-8 shadow-inner",
    className,
  )}
  data-testid="curation-group-{group.id}"
>
  <div
    class="mb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2"
  >
    <h3 class="font-bold text-lg flex items-center gap-2">
      <span class="text-amber-600 dark:text-amber-500">Řešení duplicit</span>
      <span
        class="text-xs font-mono text-muted-foreground bg-white dark:bg-slate-800 border px-2 py-0.5 rounded"
      >
        {group.id.slice(0, 8)}
      </span>
    </h3>
    <div class="text-sm text-muted-foreground">
      Podobnost: {Math.round((group.similarity ?? 0) * 100)}%
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {#each items as item (item.id)}
      <PhotoGridItem
        {item}
        mode="curation"
        curationGroup={group}
        {onDelete}
        {onArchive}
        {onCopyMetadata}
        {onPasteMetadata}
        {onSelect}
      />
    {/each}
  </div>
</div>

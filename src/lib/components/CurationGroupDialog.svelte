<script lang="ts">
  import type { CurationGroup, ImageEntry } from "$lib/types/manifest";
  import { getImageById } from "$lib/utils/images";

  let {
    open = $bindable(false),
    group,
    onDelete,
    onArchive,
    onCopyMetadata,
    onPasteMetadata,
    onSelect,
  } = $props<{
    open: boolean;
    group: CurationGroup | null;
    onDelete?: (item: ImageEntry) => void;
    onArchive?: (item: ImageEntry) => void;
    onCopyMetadata?: (item: ImageEntry) => void;
    onPasteMetadata?: (item: ImageEntry, onlyThis?: boolean) => void;
    onSelect?: (item: ImageEntry, shiftKey: boolean) => void;
  }>();

  let _items = $derived.by(() => {
    if (!group) return [];
    return group.items
      .map((id: string) => getImageById(id))
      .filter((i: ImageEntry | undefined): i is ImageEntry => !!i);
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="max-w-[90vw] md:max-w-screen-xl max-h-[90vh] overflow-y-auto"
    data-testid="curation-group-dialog-content"
  >
    <Dialog.Header>
      <Dialog.Title>Porovnání duplicit</Dialog.Title>
    </Dialog.Header>

    {#if group && items.length > 0}
      <CurationGroupView
        {group}
        {items}
        class="border-0 shadow-none bg-transparent dark:bg-transparent my-0 p-0"
        {onDelete}
        {onArchive}
        {onCopyMetadata}
        {onPasteMetadata}
        {onSelect}
      />
    {/if}
  </Dialog.Content>
</Dialog.Root>

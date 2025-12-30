<script lang="ts">
  import CurationGroupView from "$lib/components/CurationGroup.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
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

  let items = $derived.by(() => {
    if (!group) return [];
    return group.items
      .map((id: string) => getImageById(id))
      .filter((i: ImageEntry | undefined): i is ImageEntry => !!i);
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="max-h-[90vh] max-w-[90vw] overflow-y-auto md:max-w-screen-xl"
    data-testid="curation-group-dialog-content"
  >
    <Dialog.Header>
      <Dialog.Title>Porovnání duplicit</Dialog.Title>
    </Dialog.Header>

    {#if group && items.length > 0}
      <CurationGroupView
        {group}
        {items}
        class="my-0 border-0 bg-transparent p-0 shadow-none dark:bg-transparent"
        {onDelete}
        {onArchive}
        {onCopyMetadata}
        {onPasteMetadata}
        {onSelect}
      />
    {/if}
  </Dialog.Content>
</Dialog.Root>

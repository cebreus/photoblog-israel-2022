<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { useScrollspy } from "$lib/actions/scrollspy";
  import ArchiveImageDialog from "$lib/components/ArchiveImageDialog.svelte";
  import CurationGroupView from "$lib/components/CurationGroup.svelte";
  import CurationGroupDialog from "$lib/components/CurationGroupDialog.svelte";
  import DeleteImageDialog from "$lib/components/DeleteImageDialog.svelte";
  import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
  import PhotoGridItem from "$lib/components/PhotoGridItem.svelte";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { debug } from "$lib/stores/debug";
  import { editMode, selection } from "$lib/stores/editorState";
  import { selectedAuthors } from "$lib/stores/filters";
  import { metadataClipboard } from "$lib/stores/metadataClipboard";
  import { isCurationMode } from "$lib/stores/uiState";
  import type { CurationGroup, CurationManifest, ImageEntry, Separator } from "$lib/types/manifest";
  import { toSlug } from "$lib/utils/strings";
  import { toast } from "svelte-sonner";

  let { items, curationManifest } = $props<{
    items: DisplayItem[];
    curationManifest?: CurationManifest;
  }>();

  // Derived edit mode state
  let isEditMode = $derived($editMode);
  let hasSelection = $derived($selection.size > 0);

  // Identify images that start a new location block (dimmed locations)
  // Maps image ID -> scrollspy ID ("loc-{slug}")
  let dimmedLocationMap = $derived.by(() => {
    const map = new Map<string, string>();
    let currentLoc = "";

    for (const item of items) {
      if (item.type === "separator") {
        currentLoc = item.location;
      } else if (item.type === "image") {
        // Retrieve location from ImageEntry (it has top-level location property)
        const itemLoc = item.location;
        if (itemLoc && itemLoc !== "Unknown" && itemLoc !== currentLoc) {
          // This image starts a new implicit location block
          map.set(item.id, `loc-${toSlug(itemLoc)}`);
          currentLoc = itemLoc;
        }
      }
    }
    return map;
  });

  // Map image ID to Curation Group
  let curationMap = $derived.by(() => {
    const map = new Map<string, CurationGroup>();
    if (!curationManifest?.groups) return map;

    for (const group of curationManifest.groups) {
      for (const id of group.items) {
        map.set(id, group);
      }
    }
    return map;
  });

  // Selection clearing effect remains here as it affects global selection state
  $effect(() => {
    // Clear selection if mode disabled
    if (!isEditMode && $selection.size > 0) {
      selection.clear();
    }
  });

  type DisplayItem = ImageEntry | Separator;

  // Deletion and Metadata logic remains here to orchestrate dialogs
  let isDeleting = $state(false);
  let deleteDialogOpen = $state(false);
  let imagesToDelete = $state<ImageEntry[]>([]);

  let isPastingOpen = $state(false);
  let imagesToPaste = $state<ImageEntry[]>([]);
  let isApplyingPaste = $state(false);

  let isArchiving = $state(false);
  let archiveDialogOpen = $state(false);
  let imagesToArchive = $state<ImageEntry[]>([]);

  let curationDialogOpen = $state(false);
  let curationGroupToView = $state<CurationGroup | null>(null);

  function handleOpenCurationDialog(group: CurationGroup) {
    curationGroupToView = group;
    curationDialogOpen = true;
  }

  function openDeleteDialog(item: ImageEntry) {
    imagesToDelete = [item];
    deleteDialogOpen = true;
  }



  async function confirmDelete() {
    if (imagesToDelete.length === 0) return;

    isDeleting = true;
    try {
      const itemsPayload = imagesToDelete.map((img) => ({
        id: img.id,
        src: img.src,
      }));

      const res = await fetch("/api/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: itemsPayload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba při mazání souboru");
      }

      const result = await res.json();

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((e: string) => toast.warning(e));
      }

      const deletedCount = result.deleted.length;
      if (deletedCount > 0) {
        toast.success(`Úspěšně smazáno ${deletedCount} souborů. Stránka se obnoví.`);
      }

      // Close dialog
      deleteDialogOpen = false;

      // Remove from selection if selected
      const deletedIds = new Set(result.deleted);
      if ($selection.size > 0) {
        // We can't iterate and delete safely, so we filter
        // Actually, just remove known deleted IDs
        for (const id of deletedIds) {
          if ($selection.has(id as string)) selection.remove(id as string);
        }
      }

      // Refresh data remove deleted images from grid
      await invalidateAll();

      // Clear the imagesToDelete
      imagesToDelete = [];
    } catch (e: any) {
      console.error(e);
      toast.error(`Nepodařilo se smazat soubory: ${e.message}`);
    } finally {
      isDeleting = false;
    }
  }

  function handleArchive(item: ImageEntry) {
    if ($selection.has(item.id) && $selection.size > 1) {
      imagesToArchive = items.filter(
        (i: DisplayItem): i is ImageEntry => i.type === "image" && $selection.has(i.id),
      );
    } else {
      imagesToArchive = [item];
    }
    archiveDialogOpen = true;
  }

  async function confirmArchive() {
    if (imagesToArchive.length === 0) return;

    isArchiving = true;
    try {
      const itemsPayload = imagesToArchive.map((img) => ({
        id: img.id,
        src: img.src,
      }));

      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", ids: itemsPayload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba při archivaci souborů");
      }

      const result = await res.json();

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((e: string) => toast.warning(e));
      }

      const archivedCount = result.archived.length;
      if (archivedCount > 0) {
        toast.success(`Úspěšně archivováno ${archivedCount} souborů. Stránka se obnoví.`);
      }

      // Close dialog
      archiveDialogOpen = false;

      // Remove from selection if selected
      const archivedIds = new Set(result.archived);
      if ($selection.size > 0) {
        for (const id of archivedIds) {
          if ($selection.has(id as string)) selection.remove(id as string);
        }
      }

      // Refresh data
      await invalidateAll();

      // Clear the imagesToArchive
      imagesToArchive = [];
    } catch (e: any) {
      console.error(e);
      toast.error(`Nepodařilo se archivovat soubory: ${e.message}`);
    } finally {
      isArchiving = false;
    }
  }

  function handleCopyMetadata(item: ImageEntry) {
    metadataClipboard.copy(item);
    toast.success(`Metadata zkopírována z "${item.src.split("/").pop()}"`);
  }

  function handlePasteMetadata(item: ImageEntry, onlyThis = false) {
    const clipboard = $metadataClipboard;

    if (!onlyThis && $selection.has(item.id) && $selection.size > 1) {
      // Paste to all selected
      const selected = items.filter(
        (i: DisplayItem): i is ImageEntry => i.type === "image" && $selection.has(i.id),
      );
      console.log("DEBUG: Paste Logic", {
        itemId: item.id,
        selectionSize: $selection.size,
        sourceId: clipboard.sourceImage?.id,
        selectedIds: selected.map((i: ImageEntry) => i.id),
      });

      // Filter out usage of source image as target
      imagesToPaste = selected.filter((i: ImageEntry) => i.id !== clipboard.sourceImage?.id);

      console.log(
        "DEBUG: imagesToPaste",
        imagesToPaste.map((i: ImageEntry) => i.id),
      );
    } else {
      console.log("DEBUG: Single Paste", item.id);
      // Prevent pasting to the same image that was copied
      if (clipboard.sourceImage?.id === item.id) {
        toast.error("Nemůžete vkládat metadata do stejného obrázku, ze kterého jste je kopírovali");
        return;
      }
      imagesToPaste = [item];
    }
    isPastingOpen = true;
  }

  async function confirmPaste(
    fieldsToApply: Record<string, boolean>,
    excludedImageIds: string[] = [],
  ) {
    const clipboard = $metadataClipboard;
    if (!clipboard.data || imagesToPaste.length === 0) return;

    // 1. Filter out excluded images from the operation
    const targetImages = imagesToPaste.filter((img) => !excludedImageIds.includes(img.id));

    // 2. Sync exclusion with global selection if needed
    // User requested that manual exclusion in dialog should reflect in global selection
    if (excludedImageIds.length > 0 && hasSelection) {
      excludedImageIds.forEach((id) => {
        if ($selection.has(id)) {
          selection.toggle(id);
        }
      });
    }

    if (targetImages.length === 0) {
      toast.info("Žádné obrázky k úpravě.");
      // If we filtered everything out, we still close the dialog
      isPastingOpen = false;
      return;
    }

    isApplyingPaste = true;
    try {
      const updatePayload = {
        images: targetImages.map((img) => ({
          id: img.id,
          src: img.src,
        })),
        updates: {
          title: fieldsToApply.title && clipboard.data.title ? clipboard.data.title : undefined,
          author: fieldsToApply.author && clipboard.data.author ? clipboard.data.author : undefined,
          location:
            fieldsToApply.location && clipboard.data.location ? clipboard.data.location : undefined,
          city: fieldsToApply.city && clipboard.data.city ? clipboard.data.city : undefined,
          state: fieldsToApply.state && clipboard.data.state ? clipboard.data.state : undefined,
          country:
            fieldsToApply.country && clipboard.data.country ? clipboard.data.country : undefined,
          countryCode:
            fieldsToApply.countryCode && clipboard.data.countryCode
              ? clipboard.data.countryCode
              : undefined,
          caption:
            fieldsToApply.caption && clipboard.data.caption ? clipboard.data.caption : undefined,
          keywords:
            fieldsToApply.keywords && clipboard.data.keywords?.length
              ? clipboard.data.keywords
              : undefined,
        },
      };

      const res = await fetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba při ukládání metadata");
      }

      isPastingOpen = false;
      toast.success("Metadata úspěšně vložena");

      // Refresh data
      await invalidateAll();
    } catch (e: any) {
      console.error(e);
      toast.error(`Chyba: ${e.message}`);
    } finally {
      isApplyingPaste = false;
    }
  }

  $effect(debugLog);

  function debugLog() {
    console.log("PhotoGrid debug store value:", $debug);
    if ($debug) {
      console.debug("PhotoGrid render", {
        items: items.length,
        selectedAuthors: $selectedAuthors,
        dimmedLocations: dimmedLocationMap,
      });
    }
  }

  let isCurationActive = $derived($isCurationMode && !!curationManifest);

  // Process items to integrate/inject curation groups into the flow
  let processedItems = $derived.by(() => {
    // If curation not active or no groups, just return items as is
    if (!$isCurationMode || !curationManifest?.groups) {
      return items.map((i: DisplayItem) => ({
        type: "item" as const,
        data: i,
      }));
    }

    const result: (
      | { type: "item"; data: DisplayItem }
      | { type: "group"; data: CurationGroup; items: ImageEntry[] }
    )[] = [];

    // Create a map for fast lookup of ALL images in this chunk/day
    const itemMap = new Map<string, ImageEntry>();
    items.forEach((i: DisplayItem) => {
      if (i.type === "image") itemMap.set(i.id, i);
    });

    // Pre-calculate valid groups:
    // A group is valid ONLY if it has > 1 item present in the current view (itemMap).
    // If a group has 0 or 1 item (e.g. duplicates were deleted), it effectively ceases to be a group.
    const validGroupMap = new Map<string, { group: CurationGroup; items: ImageEntry[] }>();

    for (const group of curationManifest.groups) {
      const presentItems = group.items
        .map((id: string) => itemMap.get(id))
        .filter((i: ImageEntry | undefined): i is ImageEntry => !!i);

      // ONLY treat as a group if we have actual duplicates to show
      if (presentItems.length > 1) {
        // Map EACH item id to this group result, so we can trigger the group render on the first item we encounter
        for (const item of presentItems) {
          validGroupMap.set(item.id, { group, items: presentItems });
        }
      }
    }

    const processedGroupIds = new Set<string>();

    for (const item of items) {
      if (item.type === "separator") {
        result.push({ type: "item", data: item });
        continue;
      }

      // Check if this item is part of a VALID group
      const validGroupData = validGroupMap.get(item.id);

      if (validGroupData) {
        if (!processedGroupIds.has(validGroupData.group.id)) {
          // First time encountering this valid group -> Render the full group row
          result.push({
            type: "group",
            data: validGroupData.group,
            items: validGroupData.items,
          });
          processedGroupIds.add(validGroupData.group.id);
        }
        // If we already processed this group id, we skip this item (it's inside the group row)
      } else {
        // Not in a valid group (or group dissolved because < 2 items) -> render normally
        result.push({ type: "item", data: item });
      }
    }

    return result;
  });

  // Multiselect Logic
  let lastSelectedId = $state<string | null>(null);

  // Flatten the currently displayed items into a list of images for range selection
  let visualOrderedImages = $derived.by(() => {
    const list: ImageEntry[] = [];
    for (const entry of processedItems) {
      if (entry.type === "group") {
        list.push(...entry.items);
      } else if (entry.type === "item" && entry.data.type === "image") {
        list.push(entry.data);
      }
    }
    return list;
  });

  function handleSelect(item: ImageEntry, shiftKey: boolean) {
    if (shiftKey && lastSelectedId) {
      const startIdx = visualOrderedImages.findIndex((i) => i.id === lastSelectedId);
      const endIdx = visualOrderedImages.findIndex((i) => i.id === item.id);

      if (startIdx !== -1 && endIdx !== -1) {
        const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
        const range = visualOrderedImages.slice(min, max + 1);
        selection.addMultiple(range.map((i) => i.id));
        // We don't update lastSelectedId on shift-click to preserve the anchor
        return;
      }
    }

    // Standard toggle behavior
    selection.toggle(item.id);
    if (!shiftKey) {
      lastSelectedId = item.id;
    }
  }
</script>

{#each processedItems as entry}
  {#if entry.type === "group"}
    <!-- Full width row for duplicate group using component -->
    <CurationGroupView
      items={entry.items}
      group={entry.data}
      onDelete={openDeleteDialog}
      onArchive={handleArchive}
      onCopyMetadata={handleCopyMetadata}
      onPasteMetadata={handlePasteMetadata}
      onSelect={handleSelect}
    />
  {:else}
    <!-- Standard Item Rendering -->
    {@const item = entry.data}
    {#if item.type === "image"}
      <PhotoGridItem
        {item}
        scrollspyId={dimmedLocationMap.get(item.id)}
        curationGroup={curationMap.get(item.id)}
        onDelete={openDeleteDialog}
        onArchive={handleArchive}
        onCopyMetadata={handleCopyMetadata}
        onPasteMetadata={handlePasteMetadata}
        onSelect={handleSelect}
        onOpenCurationDialog={handleOpenCurationDialog}
      />
    {:else if item.type === "separator" && item.location}
      {@const separatorId = item.id}
      {#if item.story}
        <Dialog.Root>
          <Dialog.Trigger
            class="aspect-video overflow-hidden flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg duration-500 outline-background hover:outline-orange-100 outline-4 outline-offset-2 transition-[outline-color] ease-in-out dark:from-slate-700 dark:to-slate-800"
            data-testid="photo-grid-separator-trigger-{separatorId}"
          >
            <h3 class="text-lg" data-testid="photo-grid-separator-location">
              {item.location}
            </h3>
            {#if item.city}
              <p class="text-sm text-muted-foreground" data-testid="photo-grid-separator-city">
                {item.city}
              </p>
            {/if}
            <span
              class={buttonVariants({
                size: "sm",
                variant: "link",
                class: "text-sm mt-2",
              })}
              data-testid="photo-grid-separator-show-story"
            >
              Zobrazit příběh
            </span>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{item.location}</Dialog.Title>
              {#if item.city}
                <Dialog.Description>{item.city}</Dialog.Description>
              {/if}
            </Dialog.Header>
            <div
              class="prose prose-sm dark:prose-invert max-w-none mt-4"
              id={separatorId}
              use:useScrollspy={{ id: separatorId }}
              data-testid="photo-grid-separator-story-{separatorId}"
            >
              {@html item.story}
            </div>
          </Dialog.Content>
        </Dialog.Root>
      {:else}
        <div
          class="aspect-video overflow-hidden flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg dark:from-slate-700 dark:to-slate-800"
          id={separatorId}
          use:useScrollspy={{ id: separatorId }}
          data-testid="photo-grid-separator-simple-{separatorId}"
        >
          <h3 class="text-lg" data-testid="photo-grid-separator-location">
            {item.location}
          </h3>
          {#if item.city}
            <p class="text-sm text-muted-foreground mt-1">{item.city}</p>
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
{/each}

{#if imagesToDelete.length > 0}
  <DeleteImageDialog
    bind:open={deleteDialogOpen}
    images={imagesToDelete}
    {isDeleting}
    onConfirm={confirmDelete}
  />
{/if}

{#if imagesToPaste.length > 0 && $metadataClipboard.data}
  <MetadataPasteDialog
    bind:open={isPastingOpen}
    images={imagesToPaste}
    clipboardData={$metadataClipboard.data}
    onConfirm={confirmPaste}
  />
{/if}

{#if imagesToArchive.length > 0}
  <ArchiveImageDialog
    bind:open={archiveDialogOpen}
    images={imagesToArchive}
    onConfirm={confirmArchive}
  />
{/if}

<CurationGroupDialog
  bind:open={curationDialogOpen}
  group={curationGroupToView}
  onDelete={openDeleteDialog}
  onArchive={handleArchive}
  onCopyMetadata={handleCopyMetadata}
  onPasteMetadata={handlePasteMetadata}
  onSelect={handleSelect}
/>

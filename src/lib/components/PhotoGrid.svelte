<script lang="ts">
  import { toast } from "svelte-sonner";

  import { useScrollspy } from "$lib/actions/scrollspy";
  import ArchiveImageDialog from "$lib/components/ArchiveImageDialog.svelte";
  import CurationGroupView from "$lib/components/CurationGroup.svelte";
  import CurationGroupDialog from "$lib/components/CurationGroupDialog.svelte";
  import DeleteImageDialog from "$lib/components/DeleteImageDialog.svelte";
  import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
  import PhotoGridItem from "$lib/components/PhotoGridItem.svelte";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { createLogger } from "$lib/logger";
  import { editor } from "$lib/stores/editor.svelte";
  import { filters } from "$lib/stores/filters.svelte";
  import { metadataClipboard } from "$lib/stores/metadata-clipboard.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { CurationGroup, CurationManifest, ImageEntry, Separator } from "$lib/types/manifest";
  import { performImageAction } from "$lib/utils/api-actions";
  import { IMAGE_MESSAGES } from "$lib/utils/messages";
  import { reorderArray, saveImageOrder } from "$lib/utils/reorder";
  import { findIndexById, getRange } from "$lib/utils/selection";
  import { toSlug } from "$lib/utils/strings";
  import { smartToast } from "$lib/utils/toasts";

  import { invalidateAll } from "$app/navigation";

  const logger = createLogger("PhotoGrid");

  let { items, dayId, curationManifest } = $props<{
    items: DisplayItem[];
    dayId?: string;
    curationManifest?: CurationManifest;
  }>();

  // Empty state logic
  // Empty state logic - mostly handled by parent page now
  let emptyState = $state(null);

  // Derived edit mode state

  // Maps image ID -> scrollspy ID ("loc-{slug}") for ALL images in a location
  // This ensures the location stays highlighted in the menu as long as ANY photo from it is visible
  let imageLocationMap = $derived.by(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.type === "image" && item.location && item.location !== "Unknown") {
        map.set(item.id, `loc-${toSlug(item.location)}`);
      }
    }
    return map;
  });

  // Identify images that start a new location block (for anchor IDs)
  let imageAnchorsMap = $derived.by(() => {
    const map = new Map<string, boolean>();
    let currentLoc = "";

    for (const item of items) {
      if (item.type === "separator") {
        currentLoc = item.location;
      } else if (item.type === "image") {
        const itemLoc = item.location;
        if (itemLoc && itemLoc !== "Unknown" && itemLoc !== currentLoc) {
          // This image starts a new implicit location block
          map.set(item.id, true);
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

  type DisplayItem = ImageEntry | Separator;

  // Drag & Drop state
  let draggedId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);

  // Get only image items for reordering
  let imageItems = $derived(
    items.filter(
      (i: DisplayItem): i is ImageEntry =>
        i.type === "image" || i.type === "sequence" || i.type === "panorama",
    ),
  );

  async function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId || !dayId) return;

    // Capture previous order for Undo
    const previousOrder = imageItems.map((i: ImageEntry) => i.id);

    const fromIndex = imageItems.findIndex((i: ImageEntry) => i.id === draggedId);
    const toIndex = imageItems.findIndex((i: ImageEntry) => i.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    // Reorder locally
    const reordered = reorderArray(imageItems, fromIndex, toIndex) as ImageEntry[];
    const newOrder = reordered.map((i) => i.id);

    // Save to API
    const result = await saveImageOrder({ dayId, imageIds: newOrder });

    if (result.success) {
      toast.success("Pořadí uloženo", {
        action: {
          label: "Vrátit zpět",
          onClick: async () => {
            const undoResult = await saveImageOrder({ dayId, imageIds: previousOrder });
            if (undoResult.success) {
              toast.success("Vráceno zpět");
            } else {
              toast.error("Nepodařilo se vrátit změny");
            }
          },
        },
      });
    } else {
      toast.error(result.error || "Nepodařilo se uložit pořadí");
    }

    // Reset drag state
    draggedId = null;
    dropTargetId = null;
  }

  // Deletion and Metadata logic remains here to orchestrate dialogs
  let isDeleting = $state(false);
  let deleteDialogOpen = $state(false);
  let imagesToDelete = $state<ImageEntry[]>([]);

  let isPasteDialogOpen = $state(false);
  let pasteTargets = $state<ImageEntry[]>([]);
  let isApplyingPaste = $state(false);

  let isArchiving = $state(false);
  let archiveDialogOpen = $state(false);
  let imagesToArchive = $state<ImageEntry[]>([]);

  let curationDialogOpen = $state(false);
  let curationGroupToView = $state<CurationGroup | null>(null);

  function handleOpenCurationDialog(group?: CurationGroup) {
    curationGroupToView = group ?? null;
    curationDialogOpen = true;
  }

  function openDeleteDialog(item: ImageEntry) {
    imagesToDelete = [item];
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (isDeleting) return;
    await performImageAction({
      action: "delete",
      images: imagesToDelete.map(function (img) {
        return { id: img.id, src: img.src };
      }),
      onStart: function () {
        isDeleting = true;
      },
      onFinish: function () {
        isDeleting = false;
      },
      onSuccess: function (result) {
        deleteDialogOpen = false;
        imagesToDelete = [];
        const deletedIds = new Set((result as { deleted: string[] }).deleted);
        if (editor.selection.size > 0) {
          for (const id of deletedIds) {
            if (editor.selection.has(id as string)) editor.removeSelection(id as string);
          }
        }
      },
    });
  }

  function handleArchive(item: ImageEntry) {
    if (editor.selection.has(item.id) && editor.selection.size > 1) {
      imagesToArchive = items.filter(
        (i: DisplayItem): i is ImageEntry => i.type === "image" && editor.selection.has(i.id),
      );
    } else {
      imagesToArchive = [item];
    }
    archiveDialogOpen = true;
  }

  async function confirmArchive() {
    if (isArchiving) return;
    await performImageAction({
      action: "archive",
      images: imagesToArchive.map(function (img) {
        return { id: img.id, src: img.src };
      }),
      onStart: function () {
        isArchiving = true;
      },
      onFinish: function () {
        isArchiving = false;
      },
      onSuccess: function (result) {
        archiveDialogOpen = false;
        imagesToArchive = [];
        const archivedIds = new Set((result as { archived: string[] }).archived);
        if (editor.selection.size > 0) {
          for (const id of archivedIds) {
            if (editor.selection.has(id as string)) editor.removeSelection(id as string);
          }
        }
      },
    });
  }

  function handleCopyMetadata(item: ImageEntry) {
    metadataClipboard.copy(item);
    toast.success(IMAGE_MESSAGES.metadataCopied(item.src.split("/").pop() || ""));
  }

  function handlePasteMetadata(item: ImageEntry, onlyThis = false) {
    const clipboard = metadataClipboard;

    if (!onlyThis && editor.selection.has(item.id) && editor.selection.size > 1) {
      // Paste to all selected
      const selected = items.filter(
        (i: DisplayItem): i is ImageEntry => i.type === "image" && editor.selection.has(i.id),
      );
      logger.debug("Paste Logic", {
        itemId: item.id,
        selectionSize: editor.selection.size,
        sourceId: clipboard.sourceImage?.id,
        selectedIds: selected.map((i: ImageEntry) => i.id),
      });

      // Filter out usage of source image as target
      pasteTargets = selected.filter((i: ImageEntry) => i.id !== clipboard.sourceImage?.id);

      logger.debug(
        "pasteTargets",
        pasteTargets.map((i: ImageEntry) => i.id),
      );
    } else {
      logger.debug("Single Paste", item.id);
      // Prevent pasting to the same image that was copied
      if (clipboard.sourceImage?.id === item.id) {
        toast.error(IMAGE_MESSAGES.PASTE_TO_SELF);
        return;
      }
      pasteTargets = [item];
    }
    isPasteDialogOpen = true;
  }

  async function confirmPaste(
    fieldsToApply: Record<string, boolean>,
    excludedImageIds: string[] = [],
  ) {
    const clipboard = metadataClipboard;
    if (!clipboard.data || pasteTargets.length === 0) return;

    // 1. Filter out excluded images from the operation
    const targetImages = pasteTargets.filter((img) => !excludedImageIds.includes(img.id));

    // 2. Sync exclusion with global selection if needed
    // User requested that manual exclusion in dialog should reflect in global selection
    if (excludedImageIds.length > 0 && editor.selection.size > 0) {
      excludedImageIds.forEach((id) => {
        if (editor.selection.has(id)) {
          editor.toggleSelection(id);
        }
      });
    }

    if (targetImages.length === 0) {
      toast.info(IMAGE_MESSAGES.NO_IMAGES_TO_EDIT);
      // If we filtered everything out, we still close the dialog
      isPasteDialogOpen = false;
      return;
    }

    isApplyingPaste = true;
    const performOperation = async () => {
      const data = clipboard.data;
      if (!data) return;
      const updatePayload = {
        images: targetImages.map((img) => ({
          id: img.id,
          src: img.src,
        })),
        updates: {
          title: fieldsToApply.title && data.title ? data.title : undefined,
          author: fieldsToApply.author && data.author ? data.author : undefined,
          location: fieldsToApply.location && data.location ? data.location : undefined,
          city: fieldsToApply.city && data.city ? data.city : undefined,
          state: fieldsToApply.state && data.state ? data.state : undefined,
          country: fieldsToApply.country && data.country ? data.country : undefined,
          countryCode: fieldsToApply.countryCode && data.countryCode ? data.countryCode : undefined,
          caption: fieldsToApply.caption && data.caption ? data.caption : undefined,
          keywords: fieldsToApply.keywords && data.keywords?.length ? data.keywords : undefined,
        },
      };

      const res = await fetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || IMAGE_MESSAGES.METADATA_PASTE_FAILED);
      }

      isPasteDialogOpen = false;
    };

    const promise = performOperation();

    smartToast(promise, {
      loading: IMAGE_MESSAGES.APPLYING_METADATA_PASTE,
      success: IMAGE_MESSAGES.METADATA_PASTED,
      error: (e) =>
        IMAGE_MESSAGES.ERROR_TITLE(e instanceof Error ? e.message : IMAGE_MESSAGES.UNKNOWN_ERROR),
      delay: 500,
    });

    try {
      await promise;
      // Refresh data
      await invalidateAll();
    } catch (e) {
      logger.error(e);
    } finally {
      isApplyingPaste = false;
    }
  }

  $effect(debugLog);

  function debugLog() {
    if (ui.debugMode) {
      logger.debug("PhotoGrid debug store value:", ui.debugMode);
      logger.debug("PhotoGrid render", {
        items: items.length,
        selectedAuthors: filters.selectedAuthors,
        imageLocations: imageLocationMap,
      });
    }
  }

  // Process items to integrate/inject curation groups into the flow
  let processedItems = $derived.by(() => {
    // If curation not active or no groups, just return items as is
    if (!ui.curationMode || !curationManifest?.groups) {
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
      const startIdx = findIndexById(visualOrderedImages, lastSelectedId);
      const endIdx = findIndexById(visualOrderedImages, item.id);

      if (startIdx !== -1 && endIdx !== -1) {
        const range = getRange(visualOrderedImages, startIdx, endIdx);
        editor.addMultiple(range.map((i) => i.id));
        // We don't update lastSelectedId on shift-click to preserve the anchor
        return;
      }
    }

    // Standard toggle behavior
    editor.toggleSelection(item.id);
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
    {#if item.type === "image" || item.type === "sequence" || item.type === "panorama"}
      <!-- Draggable wrapper when reorderMode is active -->
      {#if editor.reorderMode && dayId}
        <div
          draggable="true"
          class="transition-all duration-150"
          class:opacity-50={draggedId === item.id}
          class:ring-2={dropTargetId === item.id}
          class:ring-blue-500={dropTargetId === item.id}
          class:cursor-grab={!draggedId}
          class:cursor-grabbing={draggedId === item.id}
          ondragstart={(e) => {
            draggedId = item.id;
            e.dataTransfer?.setData("text/plain", item.id);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
          }}
          ondragend={() => {
            draggedId = null;
            dropTargetId = null;
          }}
          ondragover={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            if (draggedId && draggedId !== item.id) {
              dropTargetId = item.id;
            }
          }}
          ondragleave={() => {
            if (dropTargetId === item.id) dropTargetId = null;
          }}
          ondrop={(e) => {
            e.preventDefault();
            handleDrop(item.id);
          }}
          role="listitem"
          aria-grabbed={draggedId === item.id}
        >
          <PhotoGridItem
            {item}
            scrollspyId={imageLocationMap.get(item.id)}
            isAnchor={imageAnchorsMap.get(item.id)}
            curationGroup={curationMap.get(item.id)}
            onDelete={openDeleteDialog}
            onArchive={handleArchive}
            onCopyMetadata={handleCopyMetadata}
            onPasteMetadata={handlePasteMetadata}
            onSelect={handleSelect}
            onOpenCurationDialog={handleOpenCurationDialog}
          />
        </div>
      {:else}
        <PhotoGridItem
          {item}
          scrollspyId={imageLocationMap.get(item.id)}
          isAnchor={imageAnchorsMap.get(item.id)}
          curationGroup={curationMap.get(item.id)}
          onDelete={openDeleteDialog}
          onArchive={handleArchive}
          onCopyMetadata={handleCopyMetadata}
          onPasteMetadata={handlePasteMetadata}
          onSelect={handleSelect}
          onOpenCurationDialog={handleOpenCurationDialog}
        />
      {/if}
    {:else if item.type === "separator" && item.location}
      {@const separatorId = item.id}
      {#if item.story}
        <!-- Wrapper div for ScrollSpy - must be always visible in DOM for proper detection -->
        <div id={separatorId} use:useScrollspy={{ id: separatorId }} class="contents">
          <Dialog.Root>
            <Dialog.Trigger
              class="outline-background flex aspect-video flex-col items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-slate-100 to-slate-300 p-4 outline-4 outline-offset-2 transition-[outline-color] duration-500 ease-in-out hover:outline-orange-100 dark:from-slate-700 dark:to-slate-800"
              data-testid="photo-grid-separator-trigger-{separatorId}"
            >
              <h3 class="text-lg" data-testid="photo-grid-separator-location">
                {item.location}
              </h3>
              {#if item.city}
                <p class="text-muted-foreground text-sm" data-testid="photo-grid-separator-city">
                  {item.city}
                </p>
              {/if}
              <span
                class={buttonVariants({
                  size: "sm",
                  variant: "link",
                  class: "mt-2 text-sm",
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
                class="prose prose-sm dark:prose-invert mt-4 max-h-[80vh] max-w-none overflow-y-auto pr-4"
                data-testid="photo-grid-separator-story-{separatorId}"
              >
                {@html item.story}
              </div>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      {:else}
        <div
          class="flex aspect-video flex-col items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-slate-100 to-slate-300 p-4 text-center dark:from-slate-700 dark:to-slate-800"
          id={separatorId}
          use:useScrollspy={{ id: separatorId }}
          data-testid="photo-grid-separator-simple-{separatorId}"
        >
          <h3 class="text-lg" data-testid="photo-grid-separator-location">
            {item.location}
          </h3>
          {#if item.city}
            <p class="text-muted-foreground mt-1 text-sm">{item.city}</p>
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
{/each}

<DeleteImageDialog
  bind:open={deleteDialogOpen}
  images={imagesToDelete}
  {isDeleting}
  onConfirm={confirmDelete}
/>

<MetadataPasteDialog
  bind:open={isPasteDialogOpen}
  images={pasteTargets}
  clipboardData={metadataClipboard.data}
  onConfirm={confirmPaste}
  onOpenCurationDialog={handleOpenCurationDialog}
/>

<ArchiveImageDialog
  bind:open={archiveDialogOpen}
  images={imagesToArchive}
  {isArchiving}
  onConfirm={confirmArchive}
/>

<CurationGroupDialog
  bind:open={curationDialogOpen}
  group={curationGroupToView}
  onDelete={openDeleteDialog}
  onArchive={handleArchive}
  onCopyMetadata={handleCopyMetadata}
  onPasteMetadata={handlePasteMetadata}
  onSelect={handleSelect}
/>

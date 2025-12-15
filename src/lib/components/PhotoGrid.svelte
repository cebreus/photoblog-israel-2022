<script lang="ts">
import PhotoGridItem from "$lib/components/PhotoGridItem.svelte";
import type { CurationManifest, ImageEntry, Separator, CurationGroup } from "$lib/types/manifest";
import { buttonVariants } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import { debug } from "$lib/stores/debug";
import { selectedAuthors } from "$lib/stores/filters";
import { useScrollspy } from "$lib/actions/scrollspy";
import DeleteImageDialog from "$lib/components/DeleteImageDialog.svelte";
import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
import { selection, editMode } from "$lib/stores/editorState";
import { metadataClipboard } from "$lib/stores/metadataClipboard";
import { toast } from "svelte-sonner";
import { invalidateAll } from "$app/navigation";
import { toSlug } from "$lib/utils/strings";
import { isCurationMode } from "$lib/stores/uiState";

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

function openDeleteDialog(item: ImageEntry) {
  imagesToDelete = [item];
  deleteDialogOpen = true;
}

function handleKeepGroup(keptItem: ImageEntry, group: CurationGroup) {
  // Determine which items to delete (all in group EXCEPT the kept item)
  const otherIds = group.items.filter((id) => id !== keptItem.id);

  // Find the ImageEntry objects for these IDs
  const toDelete: ImageEntry[] = [];
  for (const item of items) {
    if (item.type === "image" && otherIds.includes(item.id)) {
      toDelete.push(item);
    }
  }

  if (toDelete.length > 0) {
    imagesToDelete = toDelete;
    deleteDialogOpen = true;
  } else {
    toast.info("V této skupině nejsou žádné další obrázky ke smazání.");
  }
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
      ids: targetImages.map((img) => img.id),
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
</script>

{#each processedItems as entry}
  {#if entry.type === "group"}
    <!-- Full width row for duplicate group -->
    <div
      class="col-span-full bg-slate-100 dark:bg-slate-900/50 border rounded-xl p-4 my-8 shadow-inner"
      data-testid="photo-grid-group"
    >
      <div
        class="mb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2"
      >
        <h3 class="font-bold text-lg flex items-center gap-2">
          <span class="text-amber-600 dark:text-amber-500">Řešení duplicit</span
          >
          <span
            class="text-xs font-mono text-muted-foreground bg-white dark:bg-slate-800 border px-2 py-0.5 rounded"
            >{entry.data.id.slice(0, 8)}</span
          >
        </h3>
        <div class="text-sm text-muted-foreground">
          Podobnost: {Math.round((entry.data.similarity ?? 0) * 100)}%
        </div>
      </div>

      <!-- Re-use the grid layout for items inside, or flex -->
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        {#each entry.items as item (item.id)}
          <PhotoGridItem
            {item}
            mode="curation"
            curationGroup={entry.data}
            onDelete={openDeleteDialog}
            onCopyMetadata={handleCopyMetadata}
            onPasteMetadata={handlePasteMetadata}
            onKeepGroup={handleKeepGroup}
          />
        {/each}
      </div>
    </div>
  {:else}
    <!-- Standard Item Rendering -->
    {@const item = entry.data}
    {#if item.type === "image"}
      <PhotoGridItem
        {item}
        scrollspyId={dimmedLocationMap.get(item.id)}
        curationGroup={curationMap.get(item.id)}
        onDelete={openDeleteDialog}
        onCopyMetadata={handleCopyMetadata}
        onPasteMetadata={handlePasteMetadata}
        onKeepGroup={handleKeepGroup}
      />
    {:else if item.type === "separator" && item.location}
      {@const separatorId = item.id}
      {#if item.story}
        <Dialog.Root>
          <Dialog.Trigger
            class="aspect-video flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg duration-500 outline-background hover:outline-orange-100 outline-4 outline-offset-2 transition-[outline-color] ease-in-out dark:from-slate-700 dark:to-slate-800"
            data-testid="photo-grid-separator-trigger-{separatorId}"
          >
            <h3 class="text-lg" data-testid="photo-grid-separator-location">
              {item.location}
            </h3>
            {#if item.city}
              <p
                class="text-sm text-muted-foreground"
                data-testid="photo-grid-separator-city"
              >
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
          class="aspect-video flex flex-col items-center justify-center p-4 bg-linear-to-br from-slate-100 to-slate-300 rounded-lg dark:from-slate-700 dark:to-slate-800"
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

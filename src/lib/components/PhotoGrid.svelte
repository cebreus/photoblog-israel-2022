<script lang="ts">
  import { toast } from "svelte-sonner";

  import ArchiveImageDialog from "$lib/components/ArchiveImageDialog.svelte";
  import CurationGroupView from "$lib/components/CurationGroup.svelte";
  import CurationGroupDialog from "$lib/components/CurationGroupDialog.svelte";
  import DeleteImageDialog from "$lib/components/DeleteImageDialog.svelte";
  import MetadataPasteDialog from "$lib/components/MetadataPasteDialog.svelte";
  import PhotoGridItem from "$lib/components/PhotoGridItem.svelte";
  import PhotoGridSeparator from "$lib/components/PhotoGridSeparator.svelte";
  import { createLogger } from "$lib/logger";
  import { editor } from "$lib/stores/editor.svelte";
  import { filters } from "$lib/stores/filters.svelte";
  import { metadataClipboard } from "$lib/stores/metadata-clipboard.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type {
    CurationGroup,
    CurationManifest,
    ImageEntry,
    PhotoDay,
    Separator,
  } from "$lib/types/manifest";
  import { tracedFetch } from "$lib/utils/api";
  import { performImageAction } from "$lib/utils/api-actions";
  import { IMAGE_MESSAGES } from "$lib/utils/messages";
  import { reorderArray, saveImageOrder } from "$lib/utils/reorder";
  import { findIndexById, getRange } from "$lib/utils/selection";
  import { toSlug } from "$lib/utils/strings";
  import { smartToast } from "$lib/utils/toasts";

  import { browser } from "$app/environment";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";

  const logger = createLogger("PhotoGrid");

  let { items, dayId, curationManifest, eagerLoadCount } = $props<{
    items: DisplayItem[];
    dayId?: string;
    curationManifest?: CurationManifest;
    eagerLoadCount?: number;
  }>();

  // Flatten all items from all photoDays for sequence member lookup
  let allPhotoDayItems = $derived(
    (page.data.photoDays || []).flatMap((day: PhotoDay) => day.items),
  );

  // Empty state logic
  // Empty state logic - mostly handled by parent page now
  let emptyState = $state(null);

  // Derived edit mode state

  // Maps image ID -> scrollspy ID ("loc-{slug}" or separator ID) for ALL images in a location
  // This ensures the location stays highlighted in the menu as long as ANY photo from it is visible
  let imageLocationMap = $derived.by(() => {
    const map = new Map<string, string>();
    let currentSeparatorId = "";
    for (const item of items) {
      if (item.type === "separator") {
        currentSeparatorId = item.id;
      } else if (
        (item.type === "image" ||
          item.type === "collage" ||
          item.type === "panorama" ||
          item.type === "sequence") &&
        item.location &&
        item.location !== "Unknown"
      ) {
        map.set(item.id, currentSeparatorId || `loc-${toSlug(item.location)}`);
      }
    }
    return map;
  });

  // Identify which separators should be visually displayed
  // Rule:
  // 1. Must have at least one photo (count > 0)
  // 2. AND (Count > 2 OR Has Story)
  let visibleSeparators = $derived.by(() => {
    const set = new Set<DisplayItem>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === "separator") {
        let photoCount = 0;
        // Look ahead to count photos in this section that belong to this location
        for (let j = i + 1; j < items.length; j++) {
          const nextItem = items[j];
          if (nextItem.type === "separator") break;
          // Only count photos that actually match the separator's location
          if (nextItem.location === item.location) {
            photoCount++;
          }
        }

        const hasStory = !!item.story;
        // The separator is visible if it's not empty AND (has enough photos OR has a story to tell)
        if (photoCount > 0 && (photoCount > 2 || hasStory)) {
          set.add(item);
        }
      }
    }
    return set;
  });

  // Identify images that start a new location block (for anchor IDs)
  // Only used as fallback if there is no separator for this location block
  let imageAnchorsMap = $derived.by(() => {
    const map = new Map<string, boolean>();
    let currentLoc = "";
    let hasSeparatorForCurrentLoc = false;

    for (const item of items) {
      if (item.type === "separator") {
        currentLoc = item.location;
        hasSeparatorForCurrentLoc = true;
      } else if (
        item.type === "image" ||
        item.type === "collage" ||
        item.type === "panorama" ||
        item.type === "sequence"
      ) {
        if (item.location && item.location !== "Unknown" && item.location !== currentLoc) {
          // This image starts a new implicit location block
          if (!hasSeparatorForCurrentLoc) {
            map.set(item.id, true);
          }
          currentLoc = item.location;
          hasSeparatorForCurrentLoc = false;
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

  // Calculate which items should be eagerly loaded
  // We need to find the first N *visual* items (excluding separators)
  // and mark their IDs in a set for O(1) lookup during render
  let eagerLoadIds = $derived.by(() => {
    const set = new Set<string>();
    if (!items || (eagerLoadCount ?? 0) <= 0) return set;

    let count = 0;
    const limit = eagerLoadCount ?? 0;

    for (const item of items) {
      if (item.type === "separator") continue;

      // For curation groups, we might need to eagerly load the first visible item?
      // Since curation layout isn't the primary grid layout, we focus on the standard grid items.
      // But actually, `items` passed to PhotoGrid IS the list of items for the day.
      // Curation groups are derived later in `processedItems`.
      // It's safer to just count the raw items first.

      if (
        item.type === "image" ||
        item.type === "collage" ||
        item.type === "panorama" ||
        item.type === "sequence"
      ) {
        set.add(item.id);
        count++;
        if (count >= limit) break;
      }
    }
    return set;
  });

  type DisplayItem = ImageEntry | Separator;

  // Drag & Drop state
  let draggedId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);

  // Get only image items for reordering
  let imageItems = $derived(
    items.filter(
      (i: DisplayItem): i is ImageEntry =>
        i.type === "image" ||
        i.type === "sequence" ||
        i.type === "panorama" ||
        i.type === "collage",
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
        duration: 8000,
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
        (i: DisplayItem): i is ImageEntry =>
          (i.type === "image" ||
            i.type === "sequence" ||
            i.type === "panorama" ||
            i.type === "collage") &&
          editor.selection.has(i.id),
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
      // Paste to all selected - search allPhotoDayItems to include hidden sequence members
      const selected = allPhotoDayItems.filter(
        (i: DisplayItem): i is ImageEntry =>
          (i.type === "image" ||
            i.type === "sequence" ||
            i.type === "sequence-member" ||
            i.type === "panorama" ||
            i.type === "collage") &&
          editor.selection.has(i.id),
      );
      logger.debug(
        {
          itemId: item.id,
          selectionSize: editor.selection.size,
          sourceId: clipboard.sourceImage?.id,
          selectedIds: selected.map((i: ImageEntry) => i.id),
        },
        "Paste Logic",
      );

      // Filter out usage of source image as target
      pasteTargets = selected.filter((i: ImageEntry) => i.id !== clipboard.sourceImage?.id);

      logger.debug({ pasteTargetIds: pasteTargets.map((i: ImageEntry) => i.id) }, "pasteTargets");
    } else {
      logger.debug({ itemId: item.id }, "Single Paste");
      // Prevent pasting to the same image that was copied
      if (clipboard.sourceImage?.id === item.id) {
        toast.error(IMAGE_MESSAGES.PASTE_TO_SELF);
        return;
      }

      // Single paste - expand to all sequence members if applicable
      if (item.sequenceInfo && !onlyThis) {
        const baseId = item.sequenceInfo.baseId;
        const allMembers = allPhotoDayItems.filter(
          (i: DisplayItem): i is ImageEntry =>
            (i.type === "image" ||
              i.type === "sequence" ||
              i.type === "sequence-member" ||
              i.type === "panorama" ||
              i.type === "collage") &&
            i.sequenceInfo?.baseId === baseId,
        );
        pasteTargets = allMembers.filter((i: ImageEntry) => i.id !== clipboard.sourceImage?.id);
        logger.debug(
          { expandedIds: pasteTargets.map((i) => i.id) },
          "Expanded sequence paste targets",
        );
      } else {
        pasteTargets = [item];
      }
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

      const res = await tracedFetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        let errorMessage = IMAGE_MESSAGES.METADATA_PASTE_FAILED;
        try {
          const err = await res.json();
          errorMessage = err.message || errorMessage;
          if (err.errors && Array.isArray(err.errors)) {
            logger.error({ errors: err.errors }, "Batch processing errors");
          }
        } catch (e) {
          logger.error({ err: e }, "Failed to parse error response");
        }
        throw new Error(errorMessage);
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
      logger.error({ err: e }, "Failed to paste metadata");
    } finally {
      isApplyingPaste = false;
    }
  }

  async function handleResetReleaseDate(item: ImageEntry, onlyThis = false) {
    let targetImages: ImageEntry[] = [];

    if (!onlyThis && editor.selection.has(item.id) && editor.selection.size > 1) {
      // Reset for all selected - include hidden sequence members
      targetImages = allPhotoDayItems.filter(
        (i: DisplayItem): i is ImageEntry =>
          (i.type === "image" ||
            i.type === "sequence" ||
            i.type === "sequence-member" ||
            i.type === "panorama" ||
            i.type === "collage") &&
          editor.selection.has(i.id),
      );
    } else if (item.sequenceInfo && !onlyThis) {
      // Expand to all sequence members
      const baseId = item.sequenceInfo.baseId;
      targetImages = allPhotoDayItems.filter(
        (i: DisplayItem): i is ImageEntry =>
          (i.type === "image" ||
            i.type === "sequence" ||
            i.type === "sequence-member" ||
            i.type === "panorama" ||
            i.type === "collage") &&
          i.sequenceInfo?.baseId === baseId,
      );
    } else {
      // Single image
      targetImages = [item];
    }

    if (targetImages.length === 0) {
      toast.error("Žádné obrázky k resetování");
      return;
    }

    const performReset = async () => {
      const updatePayload = {
        images: targetImages.map((img) => ({
          id: img.id,
          src: img.src,
        })),
        updates: {
          releaseDate: null, // null triggers reset to original date
        },
      };

      const res = await tracedFetch("/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Nepodařilo se resetovat datum řazení");
      }
    };

    const promise = performReset();

    smartToast(promise, {
      loading: `Resetuji datum řazení (${targetImages.length}×)...`,
      success: `Datum řazení resetováno (${targetImages.length}×)`,
      error: (e) => (e instanceof Error ? e.message : "Nepodařilo se resetovat"),
      delay: 500,
    });

    try {
      await promise;
      await invalidateAll();
    } catch (e) {
      logger.error({ err: e }, "Failed to reset release date");
    }
  }

  async function handleSwapTimes() {
    if (editor.selection.size < 2) {
      toast.error(
        "Pro prohození časů musí být vybrány alespoň 2 fotky (reprezentující 2 skupiny).",
      );
      return;
    }
    const ids = Array.from(editor.selection);

    const promise = fetch("/api/images/swap-time", {
      method: "POST",
      body: JSON.stringify({ dayId, imageIds: ids }),
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || err.error || "Chyba serveru");
      }
      return r.json();
    });

    smartToast(promise, {
      loading: "Prohazuji časy...",
      success: "Časy úspěšně prohozeny",
      error: (e) => (e instanceof Error ? e.message : "Chyba při prohození"),
    });

    try {
      await promise;
      await invalidateAll();
    } catch (e) {
      logger.error({ err: e }, "Failed to swap times");
    }
  }

  async function handleRedistributeTimes() {
    if (editor.selection.size < 2) {
      toast.error("Pro rozprostření časů musí být vybrány alespoň 2 fotky.");
      return;
    }
    const ids = Array.from(editor.selection);

    // Capture state for Undo: Map of ID -> original releaseDate
    const originalDates = new Map<string, string | null>();
    // We need to find the items to get their current releaseDate
    // Search in 'items' prop first, but fall back to 'allPhotoDayItems' to be safe
    const allItems = (page.data.photoDays || []).flatMap((day: PhotoDay) => day.items);

    for (const id of ids) {
      const item = allItems.find((i: DisplayItem) => i.id === id) as ImageEntry | undefined;
      if (item) {
        // Prefer existing releaseDate, fallback to date (EXIF), or null if neither (shouldn't happen for valid images)
        originalDates.set(id, item.exif?.releaseDate || item.exif?.date || null);
      }
    }

    const promise = fetch("/api/images/redistribute", {
      method: "POST",
      body: JSON.stringify({ dayId, imageIds: ids }),
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || err.error || "Chyba serveru");
      }
      return r.json();
    });

    toast.promise(promise, {
      loading: `Rozprostírám časy (${ids.length}×)...`,
      success: (result) => `Časy rozprostřeny (${result.redistributed}×)`,
      error: (e) => (e instanceof Error ? e.message : "Chyba při rozprostření"),
      action: {
        label: "Vrátit zpět",
        onClick: async () => {
          let successCount = 0;
          const total = ids.length;

          const undoToastId = toast.loading(`Vracím změny (0/${total})...`);

          try {
            // To prevent flooding, we can do parallel limits or sequential. Sequential is safer.
            for (const [id, originalDate] of originalDates) {
              if (!originalDate) continue;

              await fetch("/api/images", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  images: [{ id, src: "" }],
                  updates: { releaseDate: originalDate },
                }),
              });
              successCount++;
              // Update toast occasionally
              if (successCount % 5 === 0)
                toast.loading(`Vracím změny (${successCount}/${total})...`, { id: undoToastId });
            }

            toast.success("Změny vráceny", { id: undoToastId });
            await invalidateAll();
          } catch (e) {
            logger.error({ err: e }, "Failed to undo redistribution");
            toast.error("Nepodařilo se vrátit všechny změny", { id: undoToastId });
          }
        },
      },
    });

    try {
      await promise;
      await invalidateAll();
    } catch (e) {
      logger.error({ err: e }, "Failed to redistribute times");
    }
  }

  $effect(debugLog);

  function debugLog() {
    if (ui.debugMode) {
      logger.debug({ debugMode: ui.debugMode }, "PhotoGrid debug store value");
      logger.debug(
        {
          itemsCount: items.length,
          itemTypes: items.map((i: DisplayItem) => i.type),
          visibleSeparatorsCount: visibleSeparators.size,
          visibleSeparators: Array.from(visibleSeparators),
          selectedAuthors: filters.selectedAuthors,
          imageLocations: imageLocationMap,
        },
        "PhotoGrid render",
      );
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
      if (
        i.type === "image" ||
        i.type === "collage" ||
        i.type === "panorama" ||
        i.type === "sequence"
      )
        itemMap.set(i.id, i);
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
      } else if (
        entry.type === "item" &&
        (entry.data.type === "image" ||
          entry.data.type === "collage" ||
          entry.data.type === "panorama" ||
          entry.data.type === "sequence")
      ) {
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

    // If this item is part of a sequence, select ALL members of the sequence
    if (item.sequenceInfo) {
      const baseId = item.sequenceInfo.baseId;

      // Search through ALL photoDays for sequence members
      // Include: "sequence" (representative), "sequence-member" (hidden members), "image" with sequenceInfo
      const allMembers = allPhotoDayItems.filter(
        (i: DisplayItem): i is ImageEntry =>
          (i.type === "image" ||
            i.type === "sequence" ||
            i.type === "sequence-member" ||
            i.type === "panorama" ||
            i.type === "collage") &&
          i.sequenceInfo?.baseId === baseId,
      );
      const memberIds = allMembers.map((m: ImageEntry) => m.id);

      // Toggle behavior: if ANY member is selected, deselect all; otherwise select all
      const anySelected = memberIds.some((id: string) => editor.selection.has(id));

      if (anySelected) {
        editor.removeMultiple(memberIds);
      } else {
        editor.addMultiple(memberIds);
      }

      if (!shiftKey && memberIds.length > 0) {
        lastSelectedId = memberIds[0];
      }
    } else {
      // Standard toggle behavior for non-sequence items
      editor.toggleSelection(item.id);
      if (!shiftKey) {
        lastSelectedId = item.id;
      }
    }
  }

  // Combine store state with URL param to prevent layout shift during SSR/hydration
  let showMetadata = $derived(
    editor.showMetadataOverlay ||
      (browser &&
        page.url.searchParams.has("overlay") &&
        page.url.searchParams.get("overlay") !== "false"),
  );
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
      onSelect={handleSelect}
      {eagerLoadIds}
    />
  {:else}
    <!-- Standard Item Rendering -->
    {@const item = entry.data}
    {#if item.type === "image" || item.type === "sequence" || item.type === "panorama" || item.type === "collage"}
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
            onResetReleaseDate={handleResetReleaseDate}
            onSwapTimes={handleSwapTimes}
            onRedistributeTimes={handleRedistributeTimes}
            onOpenCurationDialog={handleOpenCurationDialog}
            onSelect={handleSelect}
            loading={eagerLoadIds.has(item.id) ? "eager" : "lazy"}
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
          onResetReleaseDate={handleResetReleaseDate}
          onSwapTimes={handleSwapTimes}
          onRedistributeTimes={handleRedistributeTimes}
          onSelect={handleSelect}
          onOpenCurationDialog={handleOpenCurationDialog}
          loading={eagerLoadIds.has(item.id) ? "eager" : "lazy"}
        />
      {/if}
    {:else if item.type === "separator" && item.location}
      <PhotoGridSeparator
        {item}
        showMetadataOverlay={showMetadata}
        {dayId}
        isEmpty={!visibleSeparators.has(item)}
      />
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
  onSelect={handleSelect}
/>

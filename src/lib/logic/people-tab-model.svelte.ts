import { browser, dev } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { createLogger } from "$lib/logger";
import { filters } from "$lib/stores/filters.svelte";
import { people } from "$lib/stores/people.svelte";
import { type Person, type PhotoDayItem, isImageEntry } from "$lib/types/manifest";
import { buildImagePeopleMap } from "$lib/utils/gallery";
import { PERSON_MESSAGES } from "$lib/utils/messages";
import { updatePeopleOrThrow } from "$lib/utils/people-actions";
import { untrack } from "svelte";
import { toast } from "svelte-sonner";

const logger = createLogger("PeopleTabModel");

export type ConfirmDialogConfig = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function createPeopleTabModel(params?: {
  invalidDetections?: Array<{
    imageId: string;
    box: { x: number; y: number; width: number; height: number };
  }>;
  mergeMutation?: {
    mutateAsync: (params: {
      sourcePersonIds: string[];
      targetPersonId: string;
    }) => Promise<unknown>;
    isPending: boolean;
  };
  updateMutation?: {
    mutateAsync: (params: { updates: Array<{ id: string; name?: string }> }) => Promise<unknown>;
    isPending: boolean;
  };
}) {
  // --- STATE ---
  let selectedForMerge = $state<string[]>([]);
  let lastSelectedMergeId = $state<string | null>(null);

  // Processing & UI State
  let isSaving = $state(false);
  let processingIds = $state(new Set<string>());
  let lastUpdateTimestamp = $state(typeof window !== "undefined" ? Date.now() : 0);

  // Dialog State
  let showMergeConfirmDialog = $state(false);
  let confirmDialog = $state<{ open: boolean; config: ConfirmDialogConfig | null }>({
    open: false,
    config: null,
  });

  // Constraints (from TanStack Query)
  const invalidDetections = $derived(params?.invalidDetections ?? []);

  // Person Detail
  let detailPerson = $state<Person | null>(null);
  let showPersonDetail = $state(false);

  // Editing State
  let editingPersonId = $state<string | null>(null);
  let editingName = $state("");

  // Selection Logic State
  let lastSelectedFilterId = $state<string | null>(null);

  // --- ACTIONS ---

  function setProcessing(id: string, busy: boolean) {
    if (busy) processingIds.add(id);
    else processingIds.delete(id);
    processingIds = new Set(processingIds);
  }

  // --- STATS ---
  const stats = $derived.by(() => {
    if (typeof performance !== "undefined") {
      performance.mark("people-stats-start");
    }

    const list = people.visiblePeople;
    const namedCount = list.filter((p) => p.isUserNamed).length;
    const totalFaces = list.reduce((acc, p: Person) => acc + p.faceCount, 0);
    const personIds = new Set(list.map((p) => p.id));

    // Replicate gallery visibility rules
    const isGloballyVisible = (item: PhotoDayItem) => {
      if (item.type !== "image") return false;
      if (isImageEntry(item) && item.category === "collage-source") return false;
      if (item.id.includes("--frame-") && !item.id.includes("--frame-0")) {
        return false;
      }
      return true;
    };

    let totalWithFaces = 0;
    const imagePeopleMap = buildImagePeopleMap(people.photoDays);

    for (const day of people.photoDays) {
      for (const item of day.items) {
        if (isGloballyVisible(item) && isImageEntry(item)) {
          const itemPeople = item.people || imagePeopleMap[item.id] || [];
          if (itemPeople.some((id: string) => personIds.has(id))) {
            totalWithFaces++;
          }
        }
      }
    }

    let visibleWithFaces = 0;
    for (const day of filters.filteredPhotoDays) {
      for (const item of day.items) {
        if (isGloballyVisible(item) && isImageEntry(item)) {
          const itemPeople = item.people || imagePeopleMap[item.id] || [];
          if (itemPeople.some((id: string) => personIds.has(id))) {
            visibleWithFaces++;
          }
        }
      }
    }

    if (typeof performance !== "undefined") {
      performance.mark("people-stats-end");
      performance.measure("people-stats", "people-stats-start", "people-stats-end");
      performance.clearMarks("people-stats-start");
      performance.clearMarks("people-stats-end");
      performance.clearMeasures("people-stats");
    }

    return {
      total: list.length,
      named: namedCount,
      faces: totalFaces,
      totalWithFaces,
      visibleWithFaces,
    };
  });

  const hasActiveFilters = $derived.by(() => {
    return (
      filters.selectedAuthors.length > 0 ||
      filters.selectedPeople.length > 0 ||
      filters.selectedQualityBuckets.length > 0 ||
      filters.selectedMediaTypes.length > 0 ||
      !filters.showOthersSnapshots ||
      !filters.showAuthorSnapshots ||
      filters.onlySnapshots
    );
  });

  const selectedHiddenCount = $derived(
    selectedForMerge.filter((id) => people.hiddenPeople.some((p) => p.id === id)).length,
  );

  const selectedJunkCount = $derived(
    selectedForMerge.filter((id) => people.junkPeople.some((p) => p.id === id)).length,
  );

  const selectionMode = $derived.by(() => {
    const selected = filters.selectedPeople;
    const visibleIds = people.visiblePeople.map((p) => p.id);

    if (selected.includes("unknown")) return "unknown";
    if (selected.length === 0) return "reset";
    if (selected.length === visibleIds.length && visibleIds.length > 0) return "all";
    return null;
  });

  // --- API / ASYNC ---
  // Note: loadConstraints removed - now handled by useConstraintsQuery in component

  function initDetailSync() {
    $effect(() => {
      if (!dev) return;
      const personId = browser ? page.url.searchParams.get("person") : null;
      const currentPeople = people.peopleWithStats;

      untrack(() => {
        if (personId && currentPeople.length > 0) {
          if (!showPersonDetail || detailPerson?.id !== personId) {
            const p = currentPeople.find((x) => x.id === personId);
            if (p) {
              detailPerson = p;
              showPersonDetail = true;
            }
          }
        } else if (!personId && showPersonDetail) {
          showPersonDetail = false;
          detailPerson = null;
        }
      });
    });

    $effect(() => {
      if (!showPersonDetail && browser) {
        const hasPersonParam = untrack(() => page.url.searchParams.has("person"));
        if (hasPersonParam) {
          const url = new URL(page.url);
          url.searchParams.delete("person");
          goto(url, { replaceState: true, noScroll: true, keepFocus: true });
        }
      }
    });
  }

  function openPersonDetail(person: Person, e?: MouseEvent) {
    if (e) {
      e.stopPropagation();
    }

    if (!dev) return;

    const url = new URL(page.url);
    url.searchParams.set("person", person.id);
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // --- SELECTION METHODS ---

  function togglePerson(personId: string, shiftKey = false) {
    let current = filters.selectedPeople;
    const visibleIds = people.visiblePeople.map((p) => p.id);

    let effectiveCurrent = current;
    if (current.length === 0) {
      effectiveCurrent = visibleIds;
    } else if (current.includes("none")) {
      effectiveCurrent = [];
    }

    let next: string[];

    if (shiftKey && lastSelectedFilterId) {
      const startIdx = visibleIds.indexOf(lastSelectedFilterId);
      const endIdx = visibleIds.indexOf(personId);

      if (startIdx !== -1 && endIdx !== -1) {
        const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
        const range = visibleIds.slice(min, max + 1);
        next = Array.from(new Set([...effectiveCurrent, ...range]));
      } else {
        next = effectiveCurrent.includes(personId)
          ? effectiveCurrent.filter((id) => id !== personId)
          : [...effectiveCurrent, personId];
      }
    } else {
      next = effectiveCurrent.includes(personId)
        ? effectiveCurrent.filter((id) => id !== personId)
        : [...effectiveCurrent, personId];
    }

    if (next.length === 0) {
      filters.selectedPeople = ["none"];
    } else if (next.length === visibleIds.length) {
      filters.selectedPeople = [];
    } else {
      filters.selectedPeople = next;
    }

    if (!shiftKey) {
      lastSelectedFilterId = personId;
    }
  }

  function clearSelection() {
    filters.selectedPeople = [];
  }

  function selectAll() {
    filters.selectedPeople = people.visiblePeople.map((p) => p.id);
  }

  function selectUnknown() {
    filters.selectedPeople = ["unknown"];
  }

  function handleSelectionPreset(mode: "all" | "unknown" | "reset" | null) {
    if (mode === "all") return selectAll();
    if (mode === "unknown") return selectUnknown();
    if (mode === "reset") return clearSelection();
  }

  // --- EDITING METHODS ---

  function startEditing(person: Person) {
    editingPersonId = person.id;
    editingName = person.name;
  }

  function cancelEditing() {
    editingPersonId = null;
    editingName = "";
  }

  async function confirmRename() {
    if (!editingPersonId || !editingName.trim()) {
      cancelEditing();
      return;
    }

    if (!params?.updateMutation) {
      logger.error({}, "updateMutation not provided to model");
      cancelEditing();
      return;
    }

    const personId = editingPersonId;
    const newName = editingName.trim();

    logger.debug({}, "Starting rename");

    try {
      // Use TanStack Query mutation - it handles loading, error, success, and cache invalidation
      await params.updateMutation.mutateAsync({
        updates: [{ id: personId, name: newName }],
      });

      // Update timestamp for thumbnail cache busting
      lastUpdateTimestamp = Date.now();
      cancelEditing();
    } catch (error) {
      // Error is already handled by mutation's onError callback
      logger.error({ err: error }, "Rename mutation failed");
    } finally {
      setProcessing(personId, false);
    }
  }

  // --- BULK ACTION HELPERS ---

  function openBulkConfirm(config: ConfirmDialogConfig) {
    confirmDialog = { open: true, config };
  }

  async function runConfirmedAction() {
    if (!confirmDialog.config) return;
    await confirmDialog.config.onConfirm();
    confirmDialog = { open: false, config: null };
  }

  async function executeBulkHide() {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      const updates = selectedForMerge.map((id) => ({ id, hidden: true }));
      await updatePeopleOrThrow(updates);

      const hiddenIds = [...selectedForMerge];
      filters.selectedPeople = filters.selectedPeople.filter((id) => !hiddenIds.includes(id));
      selectedForMerge = [];

      await new Promise((resolve) => setTimeout(resolve, 500));
      await people.refresh();
      toast.success(PERSON_MESSAGES.bulkHidden(hiddenIds.length));
    } catch (error) {
      logger.error({ err: error }, "Bulk hide failed");
      toast.error(PERSON_MESSAGES.BULK_HIDE_FAILED);
    } finally {
      isSaving = false;
    }
  }

  function handleBulkHideAction(e?: MouseEvent) {
    if (e) e.stopPropagation();
    if (selectedForMerge.length === 0) return;

    openBulkConfirm({
      title:
        selectedForMerge.length === 1
          ? "Opravdu chcete skrýt tuto osobu?"
          : `Opravdu chcete skrýt ${selectedForMerge.length} vybraných osob?`,
      description:
        "Hromadné skrytí způsobí, že se vybrané osoby nebudou zobrazovat v přehledech ani filtrech.",
      confirmLabel: "Skrýt",
      onConfirm: () => executeBulkHide(),
    });
  }

  async function executeBulkRestore(hiddenIds: string[]) {
    if (hiddenIds.length === 0) return;

    isSaving = true;
    try {
      const updates = hiddenIds.map((id) => ({ id, hidden: false }));
      await updatePeopleOrThrow(updates);

      filters.selectedPeople = filters.selectedPeople.filter((id) => !hiddenIds.includes(id));
      await new Promise((r) => setTimeout(r, 500));
      await people.refresh();
      toast.success(PERSON_MESSAGES.bulkRestored(hiddenIds.length));
    } catch (e) {
      logger.error({ err: e }, "Bulk restore failed");
      toast.error(PERSON_MESSAGES.BULK_RESTORE_FAILED);
    } finally {
      isSaving = false;
    }
  }

  function handleBulkRestore() {
    const hiddenIds = selectedForMerge.filter((id) => people.hiddenPeople.some((p) => p.id === id));
    if (hiddenIds.length === 0) return;

    openBulkConfirm({
      title: `Obnovit ${hiddenIds.length} skrytých osob?`,
      description: "Obnovené osoby se znovu objeví ve výběrech i ve fotkách.",
      confirmLabel: "Obnovit",
      onConfirm: () => executeBulkRestore(hiddenIds),
    });
  }

  async function executeBulkMarkAsJunk() {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      const updates = selectedForMerge.map((id) => ({ id, junk: true }));
      await updatePeopleOrThrow(updates);

      selectedForMerge = [];
      await new Promise((r) => setTimeout(r, 400));
      await people.refresh();
      toast.success(PERSON_MESSAGES.bulkIgnored);
    } catch (e) {
      logger.error({ err: e }, "Bulk mark-as-junk failed");
      toast.error(PERSON_MESSAGES.BULK_IGNORE_FAILED);
    } finally {
      isSaving = false;
    }
  }

  function handleBulkMarkAsJunk() {
    if (selectedForMerge.length === 0) return;

    openBulkConfirm({
      title: `Ignorovat ${selectedForMerge.length} vybraných profilů?`,
      description: "Operace je nevratná a odstraní profily ze systému i z budoucí detekce.",
      confirmLabel: "Ignorovat profily",
      onConfirm: () => executeBulkMarkAsJunk(),
    });
  }

  async function handleBulkRestoreFromJunk() {
    if (selectedJunkCount === 0) return;

    isSaving = true;
    try {
      const junkIds = selectedForMerge.filter((id) => people.junkPeople.some((p) => p.id === id));
      const updates = junkIds.map((id) => ({ id, junk: false }));

      await updatePeopleOrThrow(updates);

      selectedForMerge = selectedForMerge.filter((id) => !junkIds.includes(id));
      await new Promise((r) => setTimeout(r, 400));
      await people.refresh();
      toast.success(PERSON_MESSAGES.bulkRestoredFromJunk(junkIds.length));
    } catch (e) {
      logger.error({ err: e }, "Bulk restore from junk failed");
      toast.error(PERSON_MESSAGES.BULK_RESTORE_FAILED);
    } finally {
      isSaving = false;
    }
  }

  async function toggleHide(personId: string) {
    const p = people.peopleWithStats.find((x) => x.id === personId);
    if (!p) return;

    const newHidden = !p.hidden;
    logger.debug({ personId, newHidden }, "Toggling hide state");

    setProcessing(personId, true);
    try {
      await updatePeopleOrThrow([{ id: personId, hidden: newHidden }]);
      await people.refresh();
      toast.success(newHidden ? PERSON_MESSAGES.PERSON_HIDDEN : PERSON_MESSAGES.PERSON_RESTORED);
    } catch (e) {
      logger.error({ err: e }, "Toggle hide failed");
      toast.error(PERSON_MESSAGES.UPDATE_FAILED);
    } finally {
      setProcessing(personId, false);
    }
  }

  // --- MERGE LOGIC ---

  function toggleMergeSelection(
    personId: string,
    eventOrShift?: MouseEvent | KeyboardEvent | boolean,
  ) {
    const shiftKey =
      typeof eventOrShift === "boolean"
        ? eventOrShift
        : !!(
            eventOrShift &&
            "shiftKey" in eventOrShift &&
            (eventOrShift as { shiftKey: boolean }).shiftKey
          );

    if (shiftKey && lastSelectedMergeId) {
      const listCandidates = [
        people.visiblePeople,
        people.hiddenPeople,
        people.categoryPeople,
        people.categoryStatues,
        people.categoryPaintings,
      ];

      for (const list of listCandidates) {
        const ids = list.map((p) => p.id);
        const startIdx = ids.indexOf(lastSelectedMergeId);
        const endIdx = ids.indexOf(personId);

        if (startIdx !== -1 && endIdx !== -1) {
          const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
          const range = ids.slice(min, max + 1);
          const newSelection = new Set([...selectedForMerge, ...range]);
          selectedForMerge = Array.from(newSelection);
          return;
        }
      }
    }

    if (selectedForMerge.includes(personId)) {
      selectedForMerge = selectedForMerge.filter((id) => id !== personId);
    } else {
      selectedForMerge = [...selectedForMerge, personId];
    }

    if (!shiftKey) {
      lastSelectedMergeId = personId;
    }
  }

  function openMergeDialog() {
    if (selectedForMerge.length < 2) return;
    showMergeConfirmDialog = true;
  }

  async function confirmMerge() {
    if (selectedForMerge.length < 2) return;
    if (!params?.mergeMutation) {
      logger.error({}, "mergeMutation not provided to model");
      return;
    }

    const allPeople = people.peopleWithStats;
    const selectedPeopleData = allPeople.filter((p) => selectedForMerge.includes(p.id));
    if (selectedPeopleData.length < 2) return;

    selectedPeopleData.sort((a, b) => {
      const aIsCustom = a.isUserNamed ?? !a.id.startsWith("person-");
      const bIsCustom = b.isUserNamed ?? !b.id.startsWith("person-");
      if (aIsCustom && !bIsCustom) return -1;
      if (!aIsCustom && bIsCustom) return 1;
      return b.faceCount - a.faceCount;
    });

    const targetPerson = selectedPeopleData[0];
    const sourcePersons = selectedPeopleData.slice(1);

    logger.info(
      { sources: sourcePersons.map((p) => p.name), target: targetPerson.name },
      "Merging people",
    );

    try {
      // Use TanStack Query mutation - it handles loading, error, success, and cache invalidation
      await params.mergeMutation.mutateAsync({
        sourcePersonIds: sourcePersons.map((p) => p.id),
        targetPersonId: targetPerson.id,
      });

      // Clear selection and close dialog after successful merge
      selectedForMerge = [];
      showMergeConfirmDialog = false;
    } catch (error) {
      // Error is already handled by mutation's onError callback
      logger.error({ err: error }, "Merge mutation failed");
    }
  }

  async function executeBulkUpdateCategory(category: "person" | "statue" | "painting") {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      const updates = selectedForMerge.map((id) => ({ id, category }));
      await updatePeopleOrThrow(updates);

      selectedForMerge = [];
      await new Promise((r) => setTimeout(r, 400));
      await people.refresh();
      toast.success(PERSON_MESSAGES.CATEGORY_UPDATED);
    } catch (error) {
      logger.error({ err: error }, "Bulk category update failed");
      toast.error(PERSON_MESSAGES.CATEGORY_UPDATE_FAILED);
    } finally {
      isSaving = false;
    }
  }

  function bulkUpdateCategory(category: "person" | "statue" | "painting") {
    if (selectedForMerge.length === 0) return;

    const labels = {
      person: "Osoba",
      statue: "Socha",
      painting: "Malba",
    } as const;

    openBulkConfirm({
      title: `Změnit typ u ${selectedForMerge.length} osob?`,
      description: `Vybrané profily budou nastaveny na typ: ${labels[category]}.`,
      confirmLabel: "Změnit typ",
      onConfirm: () => executeBulkUpdateCategory(category),
    });
  }

  return {
    // State Accessors
    get selectedForMerge() {
      return selectedForMerge;
    },
    set selectedForMerge(v) {
      selectedForMerge = v;
    },
    get lastSelectedMergeId() {
      return lastSelectedMergeId;
    },
    get isSaving() {
      return isSaving;
    },
    get processingIds() {
      return processingIds;
    },
    get lastUpdateTimestamp() {
      return lastUpdateTimestamp;
    },
    get showMergeConfirmDialog() {
      return showMergeConfirmDialog;
    },
    set showMergeConfirmDialog(v) {
      showMergeConfirmDialog = v;
    },
    get confirmDialog() {
      return confirmDialog;
    },
    set confirmDialog(v) {
      confirmDialog = v;
    },
    get invalidDetections() {
      return invalidDetections;
    },
    get detailPerson() {
      return detailPerson;
    },
    get showPersonDetail() {
      return showPersonDetail;
    },
    set showPersonDetail(v) {
      showPersonDetail = v;
    },
    get editingPersonId() {
      return editingPersonId;
    },
    get editingName() {
      return editingName;
    },
    set editingName(v) {
      editingName = v;
    },

    // Derived
    get stats() {
      return stats;
    },
    get hasActiveFilters() {
      return hasActiveFilters;
    },
    get selectedHiddenCount() {
      return selectedHiddenCount;
    },
    get selectedJunkCount() {
      return selectedJunkCount;
    },
    get selectionMode() {
      return selectionMode;
    },

    // Methods
    initDetailSync,
    openPersonDetail,
    togglePerson,
    clearSelection,
    selectAll,
    selectUnknown,
    handleSelectionPreset,
    startEditing,
    cancelEditing,
    confirmRename,
    openBulkConfirm,
    runConfirmedAction,
    handleBulkHideAction,
    handleBulkRestore,
    handleBulkMarkAsJunk,
    handleBulkRestoreFromJunk,
    toggleMergeSelection,
    openMergeDialog,
    confirmMerge,
    bulkUpdateCategory,
    toggleHide,
  };
}

export type PeopleTabModel = ReturnType<typeof createPeopleTabModel>;

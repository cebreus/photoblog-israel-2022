import { browser, dev } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { createLogger } from "$lib/logger";
import * as m from "$lib/paraglide/messages";
import { filters } from "$lib/stores/filters.svelte";
import { people } from "$lib/stores/people.svelte";
import { isImageEntry, type Person, type PhotoDayItem } from "$lib/types/manifest";
import { isGloballyVisible } from "$lib/utils/gallery";
import { untrack } from "svelte";
import { toast } from "svelte-sonner";

type FaceBox = { x: number; y: number; width: number; height: number };

import { type PersonUpdate } from "$lib/api/people/types";
import type { MutateOptions } from "@tanstack/svelte-query";

const logger = createLogger("PeopleTabModel");

export type ConfirmDialogConfig = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export function createPeopleTabModel(params?: {
  getInvalidDetections?: () => Array<{
    imageId: string;
    box: { x: number; y: number; width: number; height: number };
  }>;
  mergeMutation?: {
    mutateAsync: (
      params: {
        sourcePersonIds: string[];
        targetPersonId: string;
      },
      options?: MutateOptions<
        unknown,
        Error,
        { sourcePersonIds: string[]; targetPersonId: string }
      >,
    ) => Promise<unknown>;
    isPending: boolean;
  };
  updateMutation?: {
    mutateAsync: (
      params: { updates: Array<PersonUpdate> },
      options?: MutateOptions<unknown, Error, { updates: Array<PersonUpdate> }>,
    ) => Promise<unknown>;
    isPending: boolean;
  };
  invalidateDetectionMutation?: {
    mutateAsync: (
      params: {
        personId: string;
        detections: Array<{
          imageId: string;
          box: FaceBox | undefined;
        }>;
      },
      options?: MutateOptions<unknown, Error, unknown>,
    ) => Promise<unknown>;
    isPending: boolean;
  };
}) {
  // --- STATE ---
  let selectedForMerge = $state<string[]>([]);
  let lastSelectedMergeId = $state<string | null>(null);

  // Processing & UI State
  let processingIds = $state(new Set<string>());
  let lastUpdateTimestamp = $state(typeof window !== "undefined" ? Date.now() : 0);

  // Dialog State
  let showMergeConfirmDialog = $state(false);
  let showInvalidateConfirmDialog = $state(false);
  let confirmDialog = $state<{ open: boolean; config: ConfirmDialogConfig | null }>({
    open: false,
    config: null,
  });

  // Constraints (from TanStack Query)
  const invalidDetections = $derived(params?.getInvalidDetections?.() ?? []);

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

    // Filter list to only named persons as requested
    const list = people.displayPersons.filter((p) => p.isUserNamed);

    const namedCount = list.length;
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

    for (const day of people.photoDays) {
      for (const item of day.items) {
        if (isGloballyVisible(item) && isImageEntry(item)) {
          const itemPeople = item.people || [];
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
          const itemPeople = item.people || [];
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

  const selectedPeopleData = $derived(
    people.peopleWithStats.filter((p) => selectedForMerge.includes(p.id)),
  );
  const selectedHiddenCount = $derived(selectedPeopleData.filter((p) => p.hidden).length);
  const selectedJunkCount = $derived(selectedPeopleData.filter((p) => p.junk).length);

  const namedPeople = $derived(
    people.peopleWithStats
      .filter((p) => p.isUserNamed)
      .sort((a, b) => a.name.localeCompare(b.name, "cs", { sensitivity: "base" })),
  );

  const isSaving = $derived(
    !!(params?.mergeMutation?.isPending || params?.updateMutation?.isPending),
  );

  const canHide = $derived(
    selectedForMerge.length > 0 && selectedForMerge.length > selectedHiddenCount,
  );

  const selectionMode = $derived.by(() => {
    const selected = filters.selectedPeople;
    const visibleIds = people.displayPersons.map((p) => p.id);

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

  // --- SELECTION METHODS ---

  function togglePerson(personId: string, shiftKey = false) {
    let current = filters.selectedPeople;
    // CRITICAL FIX: "Universe" must be consistent.
    // If we are operating on "visibleIds" (named people), and we toggle,
    // we should NOT accidentally include "unnamed" people in the resulting set by blindly adding/removing.

    // BUT, the original logic relied on "subtraction from all".
    // If we want "Select All" to mean "Select All Named", we need explicit actions.
    // For simple toggling, we keep the subtraction logic but ensure we handle the 'none' case correctly.

    const visibleIds = people.displayPersons.filter((p) => dev || p.isUserNamed).map((p) => p.id);

    let effectiveCurrent = current;
    if (current.length === 0) {
      effectiveCurrent = visibleIds;
    } else if (current.includes("none")) {
      // If starting from NONE, we are adding one person.
      // effectiveCurrent should be empty set to start adding to.
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
      // Check if we really have ALL (including unnamed if they were in visibleIds)
      // If displayPersons covers everyone permissible, then empty array is correct.
      filters.selectedPeople = [];
    } else {
      filters.selectedPeople = next;
    }

    if (!shiftKey) {
      lastSelectedFilterId = personId;
    }
  }

  function clearSelection() {
    filters.setPeopleNone();
  }

  function selectAll() {
    filters.setPeopleAll();
  }

  function selectSolo(personId: string) {
    filters.setPersonSolo(personId);
  }

  function selectUnknown() {
    filters.selectedPeople = ["unknown"];
  }

  function handleSelectionPreset(mode: "all" | "unknown" | "reset" | "none" | null) {
    if (mode === "all") return selectAll(); // Show all
    if (mode === "none") return clearSelection(); // Show none
    if (mode === "unknown") return selectUnknown();
    if (mode === "reset") return selectAll(); // Default reset
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
    if (!params?.updateMutation) {
      logger.error({}, "updateMutation not provided to model");
      return;
    }

    try {
      const updates = selectedForMerge.map((id) => ({ id, hidden: true }));
      const hiddenIds = [...selectedForMerge];

      await params.updateMutation.mutateAsync({ updates });

      filters.selectedPeople = filters.selectedPeople.filter((id) => !hiddenIds.includes(id));
      selectedForMerge = [];
    } catch (error) {
      logger.error({ err: error }, "Bulk hide mutation failed");
    }
  }

  function handleBulkHideAction(e?: MouseEvent) {
    if (e) e.stopPropagation();
    if (selectedForMerge.length === 0) return;

    openBulkConfirm({
      title:
        selectedForMerge.length === 1
          ? m.person_bulk_hide_confirm_title_single()
          : m.person_bulk_hide_confirm_title_plural({ count: selectedForMerge.length }),
      description: m.person_bulk_hide_confirm_description(),
      confirmLabel: m.person_bulk_hide_confirm_action(),
      onConfirm: () => executeBulkHide(),
    });
  }

  async function executeBulkRestore(hiddenIds: string[]) {
    if (hiddenIds.length === 0) return;
    if (!params?.updateMutation) {
      logger.error({}, "updateMutation not provided to model");
      return;
    }

    try {
      const updates = hiddenIds.map((id) => ({ id, hidden: false }));
      await params.updateMutation.mutateAsync({ updates });

      filters.selectedPeople = filters.selectedPeople.filter((id) => !hiddenIds.includes(id));
    } catch (e) {
      logger.error({ err: e }, "Bulk restore mutation failed");
    }
  }

  function handleBulkRestore() {
    const hiddenIds = selectedForMerge.filter((id) =>
      people.displayPersons.some((p) => p.hidden && p.id === id),
    );
    if (hiddenIds.length === 0) return;

    openBulkConfirm({
      title: m.person_bulk_restore_confirm_title({ count: hiddenIds.length }),
      description: m.person_bulk_restore_confirm_description(),
      confirmLabel: m.person_bulk_restore_confirm_action(),
      onConfirm: () => executeBulkRestore(hiddenIds),
    });
  }

  async function executeBulkMarkAsJunk() {
    if (selectedForMerge.length === 0) return;
    if (!params?.updateMutation) {
      logger.error({}, "updateMutation not provided to model");
      return;
    }

    try {
      const updates = selectedForMerge.map((id) => ({ id, junk: true }));
      await params.updateMutation.mutateAsync({ updates });

      selectedForMerge = [];
    } catch (e) {
      logger.error({ err: e }, "Bulk mark-as-junk mutation failed");
    }
  }

  function handleBulkMarkAsJunk() {
    if (selectedForMerge.length === 0) return;

    openBulkConfirm({
      title: m.person_bulk_junk_confirm_title({ count: selectedForMerge.length }),
      description: m.person_bulk_junk_confirm_description(),
      confirmLabel: m.person_bulk_junk_confirm_action(),
      onConfirm: () => executeBulkMarkAsJunk(),
    });
  }

  async function handleBulkRestoreFromJunk() {
    if (selectedJunkCount === 0) return;
    if (!params?.updateMutation) {
      logger.error({}, "updateMutation not provided to model");
      return;
    }

    try {
      const junkIds = selectedForMerge.filter((id) => people.displayJunk.some((p) => p.id === id));
      const updates = junkIds.map((id) => ({ id, junk: false }));

      await params.updateMutation.mutateAsync({ updates });

      selectedForMerge = selectedForMerge.filter((id) => !junkIds.includes(id));
    } catch (e) {
      logger.error({ err: e }, "Bulk restore from junk mutation failed");
    }
  }

  async function toggleHide(personId: string) {
    const p = people.peopleWithStats.find((x) => x.id === personId);
    if (!p) return;

    // Safety check for mutation availability
    if (!params?.updateMutation) {
      logger.error({}, "updateMutation not provided to model");
      return;
    }

    const newHidden = !p.hidden;
    const actionLabel = newHidden ? "skrýt" : "obnovit";
    logger.debug({ personId, newHidden }, "Toggling hide state");

    setProcessing(personId, true);
    try {
      await params.updateMutation.mutateAsync(
        {
          updates: [{ id: personId, hidden: newHidden }],
        },
        {
          onError: (error: Error) => {
            logger.error({ err: error }, `Failed to ${actionLabel} person ${p.name}`);
            toast.error(m.person_toast_error_generic({ action: actionLabel, name: p.name }), {
              description: error.message,
            });
          },
        },
      );
    } catch {
      // Error handled by onError callback or mutation hook default
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
        people.displayPersons,
        people.displayStatues,
        people.displayPaintings,
        people.displayJunk,
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

  async function handleMergeInto(targetPersonId: string) {
    if (selectedForMerge.length === 0) return;
    if (!params?.mergeMutation) {
      logger.error({}, "mergeMutation not provided to model");
      return;
    }

    const sourcePersonIds = selectedForMerge.filter((id) => id !== targetPersonId);
    if (sourcePersonIds.length === 0) return;

    const targetPerson = people.peopleWithStats.find((p) => p.id === targetPersonId);
    if (!targetPerson) return;

    logger.info(
      { sourceCount: sourcePersonIds.length, target: targetPerson.name },
      "Merging selected people into target",
    );

    try {
      await params.mergeMutation.mutateAsync({
        sourcePersonIds,
        targetPersonId,
      });
      selectedForMerge = [];
    } catch (error) {
      logger.error({ err: error }, "Merge-into mutation failed");
    }
  }

  async function executeBulkUpdateCategory(category: "person" | "statue" | "painting") {
    if (selectedForMerge.length === 0) return;
    if (!params?.updateMutation) {
      logger.error({}, "updateMutation not provided to model");
      return;
    }

    try {
      const updates = selectedForMerge.map((id) => ({ id, category }));
      await params.updateMutation.mutateAsync({ updates });

      selectedForMerge = [];
    } catch (error) {
      logger.error({ err: error }, "Bulk category update mutation failed");
    }
  }

  function bulkUpdateCategory(category: "person" | "statue" | "painting") {
    if (selectedForMerge.length === 0) return;

    openBulkConfirm({
      title: m.person_bulk_category_confirm_title({ count: selectedForMerge.length }),
      description: m.person_bulk_category_confirm_description({
        category:
          category === "person"
            ? m.person_category_person()
            : category === "statue"
              ? m.person_category_statue()
              : m.person_category_painting(),
      }),
      confirmLabel: m.person_bulk_category_confirm_action(),
      onConfirm: () => executeBulkUpdateCategory(category),
    });
  }

  // --- BULK INVALIDATION ---
  const bulkInvalidationCandidates = $derived.by(() => {
    if (selectedForMerge.length === 0) return [];

    // Safety check - we need access to people store
    if (!people.photoDays) return [];

    const candidates: Array<{
      id: string; // imageId
      src: string;
      personId: string;
      personName: string;
      box?: { x: number; y: number; width: number; height: number };
    }> = [];

    const selectedIdsSet = new Set(selectedForMerge);
    const selectedPeopleMap = new Map<string, Person>();
    people.peopleWithStats.forEach((p) => {
      if (selectedIdsSet.has(p.id)) selectedPeopleMap.set(p.id, p);
    });

    for (const day of people.photoDays) {
      for (const item of day.items) {
        if (isGloballyVisible(item) && isImageEntry(item) && item.people) {
          item.people.forEach((personId: string, index: number) => {
            if (selectedIdsSet.has(personId)) {
              const person = selectedPeopleMap.get(personId);
              if (person) {
                const box = item.analysis?.faces ? item.analysis.faces[index] : undefined;
                candidates.push({
                  id: item.id,
                  src: `/faces/${person.id}/${item.id}.jpg?v=${lastUpdateTimestamp}&idx=${index}`,
                  personId: person.id,
                  personName: person.name,
                  box,
                });
              }
            }
          });
        }
      }
    }
    return candidates;
  });

  function handleBulkInvalidateDetections() {
    if (selectedForMerge.length === 0) return;
    if (bulkInvalidationCandidates.length === 0) {
      toast.info(m.person_bulk_invalidate_no_detections());
      return;
    }
    showInvalidateConfirmDialog = true;
  }

  async function confirmBulkInvalidate() {
    if (!params?.invalidateDetectionMutation) {
      logger.error({}, "invalidateDetectionMutation not provided to model");
      return;
    }

    // Group detections by person
    const detectionsByPerson = new Map<
      string,
      Array<{ imageId: string; box: FaceBox | undefined }>
    >();

    for (const cand of bulkInvalidationCandidates) {
      if (!detectionsByPerson.has(cand.personId)) {
        detectionsByPerson.set(cand.personId, []);
      }
      // Pass even if box is undefined (let backend handle force invalidation)
      detectionsByPerson.get(cand.personId)?.push({
        imageId: cand.id,
        box: cand.box,
      });
    }

    if (detectionsByPerson.size === 0) return;

    // Process sequentially to avoid race conditions on manifest saves if they are not perfectly atomic/queued
    // Although the backend has a ManifestLock, safer to be sequential or Promise.all
    const promises = [];
    for (const [personId, detections] of detectionsByPerson) {
      promises.push(
        params.invalidateDetectionMutation.mutateAsync({
          personId,
          detections,
        }),
      );
    }

    try {
      await Promise.all(promises);
      toast.success(m.detection_bulk_detection_invalidated());

      // Clear selection after success
      selectedForMerge = [];
      showInvalidateConfirmDialog = false;
    } catch (e) {
      logger.error({ err: e }, "Bulk invalidate failed");
      // Individual errors handled by mutation, but we catch here for flow
    }
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
    get showInvalidateConfirmDialog() {
      return showInvalidateConfirmDialog;
    },
    set showInvalidateConfirmDialog(v) {
      showInvalidateConfirmDialog = v;
    },
    get bulkInvalidationCandidates() {
      return bulkInvalidationCandidates;
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
    get namedPeople() {
      return namedPeople;
    },
    get isSaving() {
      return isSaving;
    },
    get canHide() {
      return canHide;
    },

    // Methods
    initDetailSync,
    openPersonDetail,
    togglePerson,
    clearSelection,
    selectAll,
    selectSolo,
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
    handleBulkInvalidateDetections,
    confirmBulkInvalidate,
    toggleMergeSelection,
    openMergeDialog,
    confirmMerge,
    handleMergeInto,
    bulkUpdateCategory,
    toggleHide,
  };
}

export type PeopleTabModel = ReturnType<typeof createPeopleTabModel>;

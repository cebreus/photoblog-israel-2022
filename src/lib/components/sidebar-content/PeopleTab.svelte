<script lang="ts">
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { dev } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import PersonDetailDialog from "$lib/components/PersonDetailDialog.svelte";
  import PersonMergeDialog from "$lib/components/PersonMergeDialog.svelte";
  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Separator } from "$lib/components/ui/separator";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { createLogger } from "$lib/logger";
  import { filters } from "$lib/stores/filters.svelte";
  import { people } from "$lib/stores/people.svelte";
  import type { ImageEntry, Person } from "$lib/types/manifest";

  import SelectionBulkActions from "../SelectionBulkActions.svelte";

  import CategoryPersonCard from "./CategoryPersonCard.svelte";
  import PeopleSelectionControls from "./PeopleSelectionControls.svelte";
  import VisiblePeopleList from "./VisiblePeopleList.svelte";

  const logger = createLogger("PeopleTab");

  // Helper to split people into Named (A-Z) and Generic (Face Count) groups
  function splitAndSortPeople(list: Person[]) {
    const isGeneric = (p: Person) =>
      (p.id.startsWith("person-") && !p.id.includes("--")) ||
      p.name.toLowerCase().includes("odpojeno od");

    const sortByName = (a: Person, b: Person) =>
      a.name.localeCompare(b.name, "cs", { sensitivity: "base" });

    const named: Person[] = [];
    const generic: Person[] = [];

    for (const p of list) {
      if (isGeneric(p)) {
        generic.push(p);
      } else {
        named.push(p);
      }
    }

    named.sort(sortByName);
    generic.sort((a, b) => b.faceCount - a.faceCount);

    return { named, generic };
  }

  type ApiResponse = {
    success: boolean;
    error?: string;
  };

  type IgnoreResponse = ApiResponse & {
    results?: { id: string; hidden?: boolean; error?: string }[];
  };

  type MergeResponse = ApiResponse & {
    mergedPerson?: Person;
    updatedImageCount?: number;
    sourceOldFaceCount?: number;
    sourceNewFaceCount?: number;
    targetOldFaceCount?: number;
    targetNewFaceCount?: number;
  };

  // Subscribe to derived store with optimized stats
  let peopleList = $derived(people.peopleWithStats);

  // Named people for merge target selection (only people with custom names, not auto-generated or detached)
  const namedPeople = $derived(
    peopleList.filter(
      (p) =>
        (!p.id.startsWith("person-") || p.id.includes("--")) &&
        !p.junk &&
        !p.hidden &&
        !p.name.toLowerCase().includes("odpojeno od"),
    ),
  );

  type ConfirmDialogConfig = {
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  };

  let confirmDialog = $state<{ open: boolean; config: ConfirmDialogConfig | null }>({
    open: false,
    config: null,
  });

  let invalidDetections = $state<
    Array<{ imageId: string; box: { x: number; y: number; width: number; height: number } }>
  >([]);

  async function loadConstraints() {
    if (!dev) return;
    try {
      const res = await fetch("/api/people/invalid-detections");
      const data = await res.json();
      if (data.success) {
        invalidDetections = data.invalidDetections;
      }
    } catch (e) {
      logger.error("Failed to load constraints", e);
    }
  }

  $effect(() => {
    loadConstraints();
  });

  // Generic helper for API updates
  async function apiUpdate(
    updates: { id: string; name?: string; hidden?: boolean; junk?: boolean; category?: string }[],
  ) {
    const res = await fetch("/api/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Update failed");
    }
    return res.json();
  }

  function openBulkConfirm(config: ConfirmDialogConfig) {
    confirmDialog = { open: true, config };
  }

  async function runConfirmedAction() {
    if (!confirmDialog.config) return;
    await confirmDialog.config.onConfirm();
    confirmDialog = { open: false, config: null };
  }

  // Determine URL prefix from first available image source path
  const photoDays = $derived(people.photoDays);
  const firstImage = $derived(photoDays.flatMap((d) => d.items).find((i) => i.type === "image"));

  // Extract prefix from sources[].path which contains full path like "/egypt-2025/images/..."
  const urlPrefix = $derived(
    (() => {
      let prefix = "";
      // Type assertion safe because we filtered by type === "image"
      if (
        firstImage &&
        (firstImage as ImageEntry).sources &&
        (firstImage as ImageEntry).sources.length > 0
      ) {
        const firstPath = (firstImage as ImageEntry).sources[0].path;
        if (firstPath?.startsWith("/")) {
          // Path format: "/egypt-2025/images/previews/..." -> extract "/egypt-2025"
          const parts = firstPath.split("/");
          if (parts.length > 2) {
            prefix = `/${parts[1]}`;
          }
        }
      }
      return prefix;
    })(),
  );

  const getThumbnailSrc = (p: Person) => {
    if (!p.thumbnail) return "";
    if (p.thumbnail.startsWith("/")) return p.thumbnail;
    // If relative 'faces/foo.jpg', prepend urlPrefix
    return `${urlPrefix}/${p.thumbnail}`;
  };

  // Editing state
  let editingPersonId = $state<string | null>(null);
  let editingName = $state("");

  // Filtering state
  let lastSelectedFilterId = $state<string | null>(null);
  let isSaving = $state(false);

  // Merge state - checkbox selection
  let selectedForMerge = $state<string[]>([]);
  let lastSelectedMergeId = $state<string | null>(null);
  let showMergeConfirmDialog = $state(false);

  // Detail state for QC
  let detailPerson = $state<Person | null>(null);
  let showPersonDetail = $state(false);

  // Sync URL state for person detail (survives HMR/reload)
  $effect(() => {
    const personId = page.url.searchParams.get("person");
    const currentPeople = peopleList;

    untrack(() => {
      // 1. URL has person -> Open Dialog if not already open for this person
      if (personId && currentPeople.length > 0) {
        if (!showPersonDetail || detailPerson?.id !== personId) {
          const p = currentPeople.find((x) => x.id === personId);
          if (p) {
            detailPerson = p;
            showPersonDetail = true;
          }
        }
      }
      // 2. URL has NO person -> Close Dialog (if open and we strictly follow URL)
      else if (!personId && showPersonDetail) {
        showPersonDetail = false;
        detailPerson = null;
      }
    });
  });

  // When dialog is closed via UI (e.g. Escape or Click Outside), update URL
  $effect(() => {
    if (!showPersonDetail) {
      const hasPersonParam = untrack(() => page.url.searchParams.has("person"));
      if (hasPersonParam) {
        const url = new URL(page.url);
        url.searchParams.delete("person");
        goto(url, { replaceState: true, noScroll: true, keepFocus: true });
      }
    }
  });

  function openPersonDetail(person: Person, e?: MouseEvent) {
    e?.stopPropagation();

    // Set URL - valid even if effect handles the rest, provides immediate feedback
    const url = new URL(page.url);
    url.searchParams.set("person", person.id);
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

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

    logger.debug("Starting rename, setting isSaving to true");
    isSaving = true;
    logger.debug("isSaving is now:", isSaving);

    try {
      logger.debug("Calling API...");
      // Add minimum delay to keep overlay visible
      await Promise.all([
        renamePerson(editingPersonId, editingName.trim()),
        new Promise((resolve) => setTimeout(resolve, 500)), // Min 500ms delay
      ]);
      logger.debug("API call successful, triggering reload");
      // Trigger reload to show updated name
      await people.refresh();
      toast.success("Osoba byla úspěšně přejmenována.");
      cancelEditing();
    } catch (error) {
      logger.error("Failed to rename person:", error);
      toast.error("Přejmenování se nezdařilo.");
    } finally {
      logger.debug("Setting isSaving to false");
      isSaving = false;
      logger.debug("isSaving is now:", isSaving);
    }
  }

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
      // Filtering is only applied to the main list (visiblePeople)
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

  async function toggleHide(personId: string) {
    logger.debug("Toggling hide for person:", personId);
    isSaving = true;

    try {
      // Call API to toggle ignored flag
      const person = people.visiblePeople.find(function (p) {
        return p.id === personId;
      });
      const newHiddenState = !(person?.hidden ?? false);

      await apiUpdate([{ id: personId, hidden: newHiddenState }]);

      const isHidden = newHiddenState;
      logger.debug("Person hidden state:", isHidden);

      // Also remove from selection if being hidden
      filters.selectedPeople = filters.selectedPeople.filter((id) => id !== personId);

      // Add minimum delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Trigger reload to update UI
      await people.refresh();
      toast.success(isHidden ? "Osoba byla skryta." : "Osoba byla obnovena.");
    } catch (error) {
      logger.error("Failed to toggle hide:", error);
      toast.error("Chyba při komunikaci se serverem.");
    } finally {
      isSaving = false;
    }
  }

  async function renamePerson(personId: string, newName: string) {
    if (!newName.trim()) return;

    await apiUpdate([{ id: personId, name: newName.trim() }]);
  }

  function clearSelection() {
    // Clear selection = show all photos (default)
    filters.selectedPeople = [];
  }

  function selectAll() {
    // Select all people = show ONLY photos with people (hide photos without people)
    const allPeopleIds = people.visiblePeople.map((p) => p.id);
    filters.selectedPeople = allPeopleIds;
  }

  function selectNone() {
    filters.selectedPeople = ["none"];
  }

  // Count of selected that are hidden (for restore action state)
  const selectedHiddenCount = $derived(
    selectedForMerge.filter((id) => people.hiddenPeople.some((p) => p.id === id)).length,
  );

  const selectedJunkCount = $derived(
    selectedForMerge.filter((id) => people.junkPeople.some((p) => p.id === id)).length,
  );

  // Track quick filter preset for button group highlighting
  const selectionMode = $derived.by(() => {
    const selected = filters.selectedPeople;
    const visibleIds = people.visiblePeople.map((p) => p.id);

    if (selected.includes("none")) return "none";
    if (selected.length === 0) return "reset";
    if (selected.length === visibleIds.length && visibleIds.length > 0) return "all";
    return null;
  });

  function handleSelectionPreset(mode: "all" | "none" | "reset" | null) {
    if (mode === "all") return selectAll();
    if (mode === "none") return selectNone();
    if (mode === "reset") return clearSelection();
  }

  function handleBulkHideAction(e?: MouseEvent) {
    e?.stopPropagation();
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

  async function executeBulkHide() {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      logger.debug("Hiding:", selectedForMerge);

      // Execute single bulk request
      const updates = selectedForMerge.map((id) => ({ id, hidden: true }));
      await apiUpdate(updates);

      // Success - remove from selection store if selected
      const hiddenIds = [...selectedForMerge];
      filters.selectedPeople = filters.selectedPeople.filter((id) => !hiddenIds.includes(id));

      // Reset checkbox selection
      selectedForMerge = [];

      // Add delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reload
      await people.refresh();
      toast.success(`Bylo skryto ${hiddenIds.length} osob.`);
    } catch (error) {
      logger.error("Bulk hide failed:", error);
      toast.error("Hromadné skrytí selhalo.");
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

  async function executeBulkRestore(hiddenIds: string[]) {
    if (hiddenIds.length === 0) return;

    isSaving = true;
    try {
      const updates = hiddenIds.map((id) => ({ id, hidden: false }));
      await apiUpdate(updates);

      filters.selectedPeople = filters.selectedPeople.filter((id) => !hiddenIds.includes(id));

      await new Promise((r) => setTimeout(r, 500));
      await people.refresh();
      toast.success(`Obnoveno ${hiddenIds.length} osob.`);
    } catch (e) {
      logger.error("Bulk restore failed:", e);
      toast.error("Hromadné obnovení selhalo.");
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

  async function executeBulkMarkAsJunk() {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      const updates = selectedForMerge.map((id) => ({ id, junk: true }));
      await apiUpdate(updates);

      selectedForMerge = [];
      await new Promise((r) => setTimeout(r, 400));
      await people.refresh();
      toast.success("Vybrané profily jsou nyní ignorovány.");
    } catch (e) {
      logger.error("Bulk mark-as-junk failed:", e);
      toast.error("Hromadné ignorování selhalo.");
    } finally {
      isSaving = false;
    }
  }

  async function handleBulkRestoreFromJunk() {
    if (selectedJunkCount === 0) return;

    isSaving = true;
    try {
      const junkIds = selectedForMerge.filter((id) => people.junkPeople.some((p) => p.id === id));
      const updates = junkIds.map((id) => ({ id, junk: false }));

      await apiUpdate(updates);

      selectedForMerge = selectedForMerge.filter((id) => !junkIds.includes(id));
      await new Promise((r) => setTimeout(r, 400));
      await people.refresh();
      toast.success(`Obnoveno ${junkIds.length} profilů z junk.`);
    } catch (e) {
      logger.error("Bulk restore from junk failed:", e);
      toast.error("Hromadné obnovení z junk selhalo.");
    } finally {
      isSaving = false;
    }
  }

  // Merge functions - checkbox selection
  function toggleMergeSelection(
    personId: string,
    eventOrShift?: MouseEvent | KeyboardEvent | boolean,
  ) {
    // Normalize second argument: it can be a boolean (shiftKey) or an event object
    const shiftKey =
      typeof eventOrShift === "boolean"
        ? eventOrShift
        : !!(
            eventOrShift &&
            "shiftKey" in eventOrShift &&
            (eventOrShift as { shiftKey: boolean }).shiftKey
          );

    if (shiftKey && lastSelectedMergeId) {
      // Find which list contains both IDs to determine range
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

    // Update last clicked for next range selection (only when SHIFT not pressed)
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

    // Resolve full person objects to determine best target
    // We access 'peopleList' which is $derived(people.peopleWithStats)
    const selectedPeopleData = peopleList.filter((p) => selectedForMerge.includes(p.id));
    if (selectedPeopleData.length < 2) return;

    // Sort to find best target:
    // 1. Prefer custom names (not starting with 'person-')
    // 2. Prefer higher face count
    selectedPeopleData.sort((a, b) => {
      const aIsCustom = !a.id.startsWith("person-");
      const bIsCustom = !b.id.startsWith("person-");
      if (aIsCustom && !bIsCustom) return -1; // a comes first (target)
      if (!aIsCustom && bIsCustom) return 1;
      return b.faceCount - a.faceCount; // higher count comes first
    });

    const targetPerson = selectedPeopleData[0];
    const sourcePersons = selectedPeopleData.slice(1);

    logger.info(
      "Merging",
      sourcePersons.map((p) => p.name),
      "into",
      targetPerson.name,
    );
    isSaving = true;

    try {
      const response = await fetch("/api/people/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePersonIds: sourcePersons.map(function (p) {
            return p.id;
          }),
          targetPersonId: targetPerson.id,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as MergeResponse;
        throw new Error(error.error || "Sloučení selhalo");
      }

      logger.debug("All merges successful");

      // Add delay for loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Clear merge state
      selectedForMerge = [];
      showMergeConfirmDialog = false;

      // Trigger reload
      await people.refresh();
      toast.success("Osoby byly úspěšně sloučeny.");
    } catch (error) {
      logger.error("Failed to merge people:", error);
      toast.error("Sloučení se nezdařilo.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isSaving = false;
    }
  }

  async function handleMergeInto(targetPersonId: string) {
    if (selectedForMerge.length === 0) return;

    // Filter out the target person from sources
    const sourceIds = selectedForMerge.filter((id) => id !== targetPersonId);
    if (sourceIds.length === 0) {
      toast.error("Nelze sloučit osobu samu do sebe.");
      return;
    }

    isSaving = true;
    try {
      for (const sourcePersonId of sourceIds) {
        const response = await fetch("/api/people/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourcePersonId, targetPersonId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Merge failed");
        }
      }

      selectedForMerge = [];
      await new Promise((r) => setTimeout(r, 400));
      await people.refresh();
      toast.success(`Sloučeno ${sourceIds.length} profilů.`);
    } catch (e) {
      logger.error("Merge into failed:", e);
      toast.error("Sloučení selhalo.");
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

  async function executeBulkUpdateCategory(category: "person" | "statue" | "painting") {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      const updates = selectedForMerge.map((id) => ({ id, category }));
      await apiUpdate(updates);

      await new Promise((r) => setTimeout(r, 300));
      await people.refresh();
      toast.success(`Kategorie změněna pro ${selectedForMerge.length} osob.`);
    } catch (e) {
      logger.error("Bulk update category failed", e);
      toast.error("Hromadná změna kategorie selhala.");
    } finally {
      isSaving = false;
    }
  }

  async function markAsJunk(personId: string) {
    if (
      !confirm(
        "Opravdu chcete tuto osobu ignorovat? Všechny její detekce budou v budoucnu ignorovány a profil bude smazán.",
      )
    ) {
      return;
    }

    isSaving = true;
    try {
      await apiUpdate([{ id: personId, junk: true }]);
      toast.success("Osoba je nyní ignorována.");
      await people.refresh();
    } catch (error) {
      logger.error("Failed to mark as junk:", error);
      toast.error("Chyba při komunikaci se serverem.");
    } finally {
      isSaving = false;
    }
  }

  // Use the refresh from person detail updates too
</script>

{#snippet personGrid(list: Person[], testIdSuffix: string)}
  {@const { named, generic } = splitAndSortPeople(list)}
  {#each named as person (person.id)}
    <CategoryPersonCard
      {person}
      {getThumbnailSrc}
      onToggle={toggleMergeSelection}
      onOpenDetail={openPersonDetail}
      selected={selectedForMerge.includes(person.id)}
      testId={`people-tab-${testIdSuffix}-item`}
    />
  {/each}

  {#if named.length > 0 && generic.length > 0}
    <div class="col-span-3 py-2 flex items-center justify-center">
      <Separator class="w-full" />
    </div>
  {/if}

  {#each generic as person (person.id)}
    <CategoryPersonCard
      {person}
      {getThumbnailSrc}
      onToggle={toggleMergeSelection}
      onOpenDetail={openPersonDetail}
      selected={selectedForMerge.includes(person.id)}
      testId={`people-tab-${testIdSuffix}-item`}
    />
  {/each}
{/snippet}

<div class="contents" data-testid="people-tab">
  <Sidebar.Content>
    <div class="p-4 border-b space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm" data-testid="people-tab-title">
          Lidé ({peopleList.length})
        </h3>
      </div>

      <PeopleSelectionControls {selectionMode} onPreset={handleSelectionPreset} />
    </div>

    <div
      class="sticky top-0 z-20 backdrop-blur-lg pt-2 pb-2 px-4"
      data-testid="people-tab-bulk-actions"
    >
      <SelectionBulkActions
        count={selectedForMerge.length}
        onClear={() => (selectedForMerge = [])}
        isWorking={isSaving}
        disabled={!dev}
        class="w-full"
        testId="people-tab-bulk-actions"
        onMerge={openMergeDialog}
        onMergeInto={handleMergeInto}
        {namedPeople}
        onHide={handleBulkHideAction}
        onRestore={handleBulkRestore}
        onMarkAsJunk={handleBulkMarkAsJunk}
        onRestoreFromJunk={handleBulkRestoreFromJunk}
        onUpdateCategory={bulkUpdateCategory}
        hiddenCount={selectedHiddenCount}
        junkCount={selectedJunkCount}
        canHide={!selectedForMerge.some((id) => people.hiddenPeople.some((p) => p.id === id))}
      />
    </div>

    <VisiblePeopleList
      visiblePeople={people.visiblePeople}
      selectedPeople={filters.selectedPeople}
      {selectedForMerge}
      {editingPersonId}
      {editingName}
      {isSaving}
      {getThumbnailSrc}
      {togglePerson}
      {openPersonDetail}
      {startEditing}
      onEditingNameChange={(value) => (editingName = value)}
      {confirmRename}
      {cancelEditing}
      {toggleHide}
      {toggleMergeSelection}
    />

    <Accordion.Root type="multiple" class="mt-4">
      {#if people.hiddenPeople.length > 0 && dev}
        <Accordion.Item value="hidden" data-testid="people-tab-hidden-section">
          <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
            Skryté ({people.hiddenPeople.length})
          </Accordion.Trigger>
          <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
            {@render personGrid(people.hiddenPeople, "hidden")}
          </Accordion.Content>
        </Accordion.Item>
      {/if}

      {#if people.categoryPeople.length > 0 && dev}
        <Accordion.Item value="cat-person" data-testid="people-tab-category-person-section">
          <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
            Osoby ({people.categoryPeople.length})
          </Accordion.Trigger>
          <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
            {@render personGrid(people.categoryPeople, "category-person")}
          </Accordion.Content>
        </Accordion.Item>
      {/if}

      {#if people.categoryStatues.length > 0 && dev}
        <Accordion.Item value="cat-statue" data-testid="people-tab-category-statue-section">
          <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
            Sochy ({people.categoryStatues.length})
          </Accordion.Trigger>
          <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
            {@render personGrid(people.categoryStatues, "category-statue")}
          </Accordion.Content>
        </Accordion.Item>
      {/if}

      {#if people.categoryPaintings.length > 0 && dev}
        <Accordion.Item value="cat-painting" data-testid="people-tab-category-painting-section">
          <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
            Malby ({people.categoryPaintings.length})
          </Accordion.Trigger>
          <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
            {@render personGrid(people.categoryPaintings, "category-painting")}
          </Accordion.Content>
        </Accordion.Item>
      {/if}

      {#if people.junkPeople.length > 0 && dev}
        <Accordion.Item value="junk" data-testid="people-tab-junk-section">
          <Accordion.Trigger class="px-4 py-3 text-sm font-medium text-destructive">
            Junk ({people.junkPeople.length})
          </Accordion.Trigger>
          <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
            {@render personGrid(people.junkPeople, "junk")}
          </Accordion.Content>
        </Accordion.Item>
      {/if}

      {#if invalidDetections.length > 0 && dev}
        <Accordion.Item
          value="invalid-detections"
          data-testid="people-tab-invalid-detections-section"
        >
          <Accordion.Trigger class="px-4 py-3 text-sm font-medium opacity-50">
            Chybné detekce ({invalidDetections.length})
          </Accordion.Trigger>
          <Accordion.Content class="mb-2 px-4 pt-2 pb-1">
            <div class="text-xs text-muted-foreground flex flex-col gap-1 max-h-40 overflow-y-auto">
              {#each invalidDetections as det}
                <div class="flex items-center gap-2 py-1 border-b last:border-0 border-border/50">
                  <span class="font-mono text-[10px] tabular-nums">{det.imageId}</span>
                  <span class="text-[9px] opacity-70">
                    [{Math.round(det.box.x)}, {Math.round(det.box.y)}, {Math.round(
                      det.box.width,
                    )}×{Math.round(det.box.height)}]
                  </span>
                </div>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/if}
    </Accordion.Root>
  </Sidebar.Content>

  <Dialog.Root bind:open={confirmDialog.open}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>{confirmDialog.config?.title}</Dialog.Title>
        <Dialog.Description>{confirmDialog.config?.description}</Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button
          variant="outline"
          type="button"
          onclick={() => (confirmDialog = { open: false, config: null })}
          data-testid="people-tab-bulk-confirm-cancel"
        >
          Zrušit
        </Button>
        <Button
          variant="destructive"
          type="button"
          onclick={runConfirmedAction}
          data-testid="people-tab-bulk-confirm-submit"
        >
          {confirmDialog.config?.confirmLabel ?? "Potvrdit"}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
  <!-- Merge Confirm Dialog -->
  {#if selectedForMerge.length >= 2}
    {@const selectedPeopleData = [...peopleList]
      .filter((p) => selectedForMerge.includes(p.id))
      .sort((a, b) => {
        const aIsCustom = !a.id.startsWith("person-");
        const bIsCustom = !b.id.startsWith("person-");
        if (aIsCustom && !bIsCustom) return -1;
        if (!aIsCustom && bIsCustom) return 1;
        return b.faceCount - a.faceCount;
      })}
    {#if selectedPeopleData.length >= 2}
      {@const targetPerson = selectedPeopleData[0]}
      <PersonMergeDialog
        bind:open={showMergeConfirmDialog}
        sources={selectedPeopleData.slice(1)}
        {targetPerson}
        {urlPrefix}
        onConfirm={async () => {
          await confirmMerge();
        }}
      />
    {/if}
  {/if}

  {#if detailPerson}
    <PersonDetailDialog
      bind:open={showPersonDetail}
      person={detailPerson}
      {urlPrefix}
      onUpdate={async () => {
        await people.refresh();
      }}
    />
  {/if}
</div>

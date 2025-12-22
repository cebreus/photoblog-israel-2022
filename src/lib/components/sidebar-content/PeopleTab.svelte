<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Check from "@lucide/svelte/icons/check";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import User from "@lucide/svelte/icons/user";
  import Users from "@lucide/svelte/icons/users";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { dev } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import PersonDetailDialog from "$lib/components/PersonDetailDialog.svelte";
  import PersonMergeDialog from "$lib/components/PersonMergeDialog.svelte";
  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Switch } from "$lib/components/ui/switch";
  import { createLogger } from "$lib/logger";
  import { filters } from "$lib/stores/filters.svelte";
  import { people } from "$lib/stores/people.svelte";
  import type { ImageEntry, Person } from "$lib/types/manifest";

  import SelectionBulkActions from "../SelectionBulkActions.svelte";

  import CategoryPersonCard from "./CategoryPersonCard.svelte";

  const logger = createLogger("PeopleTab");

  type ApiResponse = {
    success: boolean;
    error?: string;
  };

  type IgnoreResponse = ApiResponse & {
    results?: { id: string; ignored?: boolean; error?: string }[];
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
  let isSaving = $state(false);

  // Merge state - checkbox selection
  let selectedForMerge = $state<string[]>([]);
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

  function togglePerson(personId: string) {
    let current = filters.selectedPeople;
    // SAME LOGIC AS AUTHORS:
    // - Empty array [] = ALL selected (default)
    // - ["none"] = NONE selected
    // - Specific IDs = only those selected

    let effectiveCurrent = current;

    // If empty, treat as "all selected"
    if (current.length === 0) {
      effectiveCurrent = people.visiblePeople.map((p) => p.id);
    } else if (current.includes("none")) {
      effectiveCurrent = [];
    }

    const isSelected = effectiveCurrent.includes(personId);
    let next: string[];

    if (isSelected) {
      // Deselect this person
      next = effectiveCurrent.filter((id) => id !== personId);
    } else {
      // Select this person
      next = [...effectiveCurrent, personId];
    }

    const allPeopleIds = people.visiblePeople.map((p) => p.id);

    // If nothing selected, use special "none" marker
    if (next.length === 0) {
      filters.selectedPeople = ["none"];
    } else if (next.length === allPeopleIds.length) {
      // If all selected, return empty array (default state)
      filters.selectedPeople = [];
    } else {
      filters.selectedPeople = next;
    }
  }

  async function toggleHide(personId: string) {
    logger.debug("Toggling hide for person:", personId);
    isSaving = true;

    try {
      // Call API to toggle ignored flag
      const response = await fetch("/api/people/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      });

      if (response.ok) {
        const data = (await response.json()) as IgnoreResponse;
        const isIgnored = data.results?.[0]?.ignored;
        logger.debug("Person ignored state:", isIgnored);

        // Also remove from selection if being ignored
        filters.selectedPeople = filters.selectedPeople.filter((id) => id !== personId);

        // Add minimum delay to show loading state
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Trigger reload to update UI
        await people.refresh();
        toast.success(isIgnored ? "Osoba byla skryta." : "Osoba byla obnovena.");
      } else {
        toast.error("Akce se nezdařila.");
      }
    } catch (error) {
      logger.error("Failed to toggle hide:", error);
      toast.error("Chyba při komunikaci se serverem.");
    } finally {
      isSaving = false;
    }
  }

  async function renamePerson(personId: string, newName: string) {
    if (!newName.trim()) return;

    await fetch("/api/people/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, name: newName.trim() }),
    });
  }

  function clearSelection() {
    // Clear selection = show all photos (default)
    filters.selectedPeople = [];
  }

  function selectAll() {
    // Select all people = show ONLY photos with people (hide photos without people)
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

    const confirmMessage =
      selectedForMerge.length === 1
        ? "Opravdu chcete skrýt tuto osobu?"
        : `Opravdu chcete skrýt ${selectedForMerge.length} osob?`;

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      logger.info("Bulk hide cancelled by user");
      return;
    }

    logger.info("Executing bulk hide after confirmation, count:", selectedForMerge.length);
    executeBulkHide();
  }

  async function executeBulkHide() {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      logger.debug("Hiding:", selectedForMerge);

      // Execute single bulk request
      const response = await fetch("/api/people/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds: selectedForMerge }),
      });

      if (!response.ok) {
        throw new Error("API požadavek selhal");
      }

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

  async function executeBulkRestore() {
    // Only restore those that are currently hidden
    const hiddenIds = selectedForMerge.filter((id) => people.hiddenPeople.some((p) => p.id === id));
    if (hiddenIds.length === 0) return;

    isSaving = true;
    try {
      // The /api/people/ignore endpoint only bulk-sets to true.
      // To restore, toggle each id individually with single POSTs.
      await Promise.all(
        hiddenIds.map((personId) =>
          fetch("/api/people/ignore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personId }),
          }),
        ),
      );

      // Remove restored from current selection filter
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

  async function executeBulkMarkAsJunk() {
    if (selectedForMerge.length === 0) return;
    if (
      !confirm(
        `Opravdu označit ${selectedForMerge.length} vybraných profilů jako 'není osoba'? Operace je nevratná.`,
      )
    ) {
      return;
    }

    isSaving = true;
    try {
      await Promise.all(
        selectedForMerge.map((personId) =>
          fetch("/api/people/mark-as-junk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personId }),
          }),
        ),
      );

      // Clear selection after destructive action
      selectedForMerge = [];
      await new Promise((r) => setTimeout(r, 400));
      await people.refresh();
      toast.success("Vybrané profily byly označeny jako neplatná detekce.");
    } catch (e) {
      logger.error("Bulk mark-as-junk failed:", e);
      toast.error("Hromadná akce 'Není osoba' selhala.");
    } finally {
      isSaving = false;
    }
  }

  // Merge functions - checkbox selection
  function toggleMergeSelection(personId: string) {
    if (selectedForMerge.includes(personId)) {
      selectedForMerge = selectedForMerge.filter((id) => id !== personId);
    } else {
      selectedForMerge = [...selectedForMerge, personId];
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
      // Execute merges sequentially
      for (const source of sourcePersons) {
        const response = await fetch("/api/people/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourcePersonId: source.id, targetPersonId: targetPerson.id }),
        });

        if (!response.ok) {
          const error = (await response.json()) as MergeResponse;
          throw new Error(`Sloučení osoby ${source.name} selhalo: ${error.error}`);
        }
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

  // Bulk category update (same options as in PersonDetail header)
  async function bulkUpdateCategory(category: "person" | "statue" | "painting") {
    if (selectedForMerge.length === 0) return;

    isSaving = true;
    try {
      await Promise.all(
        selectedForMerge.map((personId) =>
          fetch("/api/people/update-category", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personId, category }),
          }),
        ),
      );

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
        "Opravdu chcete tuto osobu označit jako 'není osoba'? Všechny její detekce budou v budoucnu ignorovány a profil bude smazán.",
      )
    ) {
      return;
    }

    isSaving = true;
    try {
      const response = await fetch("/api/people/mark-as-junk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      });

      if (response.ok) {
        toast.success("Osoba byla označena jako neplatná detekce.");
        await people.refresh();
      } else {
        toast.error("Akce se nezdařila.");
      }
    } catch (error) {
      logger.error("Failed to mark as junk:", error);
      toast.error("Chyba při komunikaci se serverem.");
    } finally {
      isSaving = false;
    }
  }

  // Use the refresh from person detail updates too
</script>

<div class="contents" data-testid="people-tab">
  <Sidebar.Content>
    <div class="p-4 border-b space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm" data-testid="people-tab-title">
          Lidé ({peopleList.length})
        </h3>
        {#if filters.selectedPeople.length > 0 && !filters.selectedPeople.includes("none")}
          <Button variant="ghost" size="sm" onclick={clearSelection} class="h-6 px-2 text-xs">
            Zrušit výběr
          </Button>
        {/if}
      </div>

      <!-- Control buttons -->
      <ButtonGroup.Root class="w-full">
        <Button
          variant={selectionMode === "all" ? "default" : "outline"}
          size="sm"
          class="flex-1 h-7 text-xs px-2"
          onclick={() => handleSelectionPreset("all")}
          data-testid="people-tab-select-all"
        >
          <Users class="w-3 h-3 mr-1" /> Vše
        </Button>
        <Button
          variant={selectionMode === "none" ? "default" : "outline"}
          size="sm"
          class="flex-1 h-7 text-xs px-2"
          onclick={() => handleSelectionPreset("none")}
          data-testid="people-tab-select-none"
        >
          <Ban class="w-3 h-3 mr-1" /> Žádné
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="flex-1 h-7 text-xs px-2"
          onclick={() => handleSelectionPreset("reset")}
          data-testid="people-tab-reset"
        >
          <RotateCcw class="w-3 h-3 mr-1" /> Reset
        </Button>
      </ButtonGroup.Root>

      <p class="text-xs text-muted-foreground">
        <strong>Vše:</strong> Jen fotky s lidmi. <strong>Žádné:</strong> Jen fotky bez lidí.
        <strong>Reset:</strong> Všechny fotky.
      </p>
    </div>

    <div class="flex flex-col">
      {#each people.visiblePeople as person (person.id)}
        {@const isSelected =
          filters.selectedPeople.length === 0
            ? true // Empty = all selected
            : filters.selectedPeople.includes("none")
              ? false // "none" = nothing selected
              : filters.selectedPeople.includes(person.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class={`relative group border-b flex items-center gap-3 p-3 px-4 hover:bg-accent/50 transition-colors cursor-pointer ${isSelected ? "bg-accent/30" : ""}`}
          onclick={() => !editingPersonId && togglePerson(person.id)}
          data-testid="people-tab-person-item"
        >
          <!-- Loading overlay -->
          {#if isSaving && editingPersonId === person.id}
            <div
              class="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center rounded"
              style="z-index: 9999;"
              data-testid="people-tab-person-loading"
            >
              <Loader2 class="w-6 h-6 animate-spin text-primary" />
            </div>
          {/if}
          <button
            type="button"
            class="relative w-10 h-10 rounded overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-border hover:ring-2 ring-primary transition-all focus:outline-none"
            onclick={(e) => openPersonDetail(person, e)}
            data-testid="people-tab-person-thumbnail-button"
          >
            {#if person.thumbnail}
              <img
                src={getThumbnailSrc(person)}
                alt={person.name}
                class="w-full h-full object-cover"
                data-testid="people-tab-person-thumbnail"
              />
            {:else}
              <div class="flex items-center justify-center w-full h-full">
                <User class="w-5 h-5 text-slate-400" />
              </div>
            {/if}
          </button>

          <div class="flex-1 min-w-0">
            {#if dev && editingPersonId === person.id}
              <!-- Editing mode -->
              <div class="flex items-center gap-2" onclick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  bind:value={editingName}
                  onkeydown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") cancelEditing();
                  }}
                  class="font-medium text-sm flex-1 bg-white dark:bg-slate-700 border border-border px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="people-tab-person-name-input"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onclick={confirmRename}
                  class="h-7 w-7 hover:bg-green-100 dark:hover:bg-green-900"
                  title="Potvrdit"
                  data-testid="people-tab-person-confirm"
                >
                  <Check class="w-4 h-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onclick={cancelEditing}
                  class="h-7 w-7 hover:bg-red-100 dark:hover:bg-red-900"
                  title="Zrušit"
                  data-testid="people-tab-person-cancel"
                >
                  <X class="w-4 h-4 text-red-600" />
                </Button>
              </div>
            {:else if dev}
              <div
                onclick={(e) => {
                  e.stopPropagation();
                  startEditing(person);
                }}
                class="font-medium text-sm w-full text-left hover:text-primary transition-colors cursor-text"
                data-testid="people-tab-person-name"
              >
                {person.name}
              </div>
            {:else}
              <!-- Production: just display name -->
              <div class="font-medium text-sm" data-testid="people-tab-person-name">
                {person.name}
              </div>
            {/if}
            <div class="text-xs text-muted-foreground" data-testid="people-tab-person-count">
              {person.faceCount} fotek
            </div>
          </div>
          <Switch
            checked={isSelected}
            class="pointer-events-none"
            data-testid="people-tab-person-switch"
          />

          {#if dev}
            <Checkbox
              checked={selectedForMerge.includes(person.id)}
              onCheckedChange={() => toggleMergeSelection(person.id)}
              onclick={(e) => e.stopPropagation()}
              class="ml-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="people-tab-person-merge-checkbox"
            />
            <Button
              variant="ghost"
              size="icon"
              onclick={(e) => {
                e.stopPropagation();
                toggleHide(person.id);
              }}
              class="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Skrýt osobu"
              data-testid="people-tab-person-ignore-button"
            >
              <EyeOff class="w-4 h-4" />
            </Button>
          {/if}
        </div>
      {/each}

      {#if people.visiblePeople.length === 0}
        <div
          class="p-8 text-center text-muted-foreground text-sm"
          data-testid="people-tab-empty-state"
        >
          Žádné osoby nebyly detekovány.
          <br /><span class="text-xs opacity-70"
            >Spusťte <code>bun scripts/face-clustering.ts</code></span
          >
        </div>
      {/if}

      <!-- Bulk Actions - appears when people selected -->
      {#if dev && selectedForMerge.length > 0}
        <div class="px-4 pt-4 mt-2" data-testid="people-tab-bulk-actions">
          <SelectionBulkActions
            count={selectedForMerge.length}
            onClear={() => (selectedForMerge = [])}
            isWorking={isSaving}
            class="w-full"
            testId="people-tab-bulk-actions"
            onMerge={openMergeDialog}
            onHide={handleBulkHideAction}
            onRestore={executeBulkRestore}
            onMarkAsJunk={executeBulkMarkAsJunk}
            onUpdateCategory={bulkUpdateCategory}
            hiddenCount={selectedHiddenCount}
            canHide={!selectedForMerge.some((id) => people.hiddenPeople.some((p) => p.id === id))}
          />
        </div>
      {/if}

      <Accordion.Root type="single" value="ignored" class="mt-4">
        {@const hiddenPersons = people.hiddenPeople}

        {#if people.hiddenPeople.length > 0 && dev}
          <Accordion.Item value="ignored" data-testid="people-tab-hidden-section">
            <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
              Skryté ({people.hiddenPeople.length})
            </Accordion.Trigger>
            <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
              {#each hiddenPersons as person (person.id)}
                <CategoryPersonCard
                  {person}
                  {getThumbnailSrc}
                  onToggle={toggleMergeSelection}
                  selected={selectedForMerge.includes(person.id)}
                  testId="people-tab-ignored-person-item"
                ></CategoryPersonCard>
              {/each}
            </Accordion.Content>
          </Accordion.Item>
        {/if}

        {#if people.categoryPeople.length > 0 && dev}
          <Accordion.Item value="cat-person" data-testid="people-tab-category-person-section">
            <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
              Osoby ({people.categoryPeople.length})
            </Accordion.Trigger>
            <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
              {#each people.categoryPeople as person (person.id)}
                <CategoryPersonCard
                  {person}
                  {getThumbnailSrc}
                  onToggle={toggleMergeSelection}
                  selected={selectedForMerge.includes(person.id)}
                  testId="people-tab-category-person-item"
                />
              {/each}
            </Accordion.Content>
          </Accordion.Item>
        {/if}

        {#if people.categoryStatues.length > 0 && dev}
          <Accordion.Item value="cat-statue" data-testid="people-tab-category-statue-section">
            <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
              Sochy ({people.categoryStatues.length})
            </Accordion.Trigger>
            <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
              {#each people.categoryStatues as person (person.id)}
                <CategoryPersonCard
                  {person}
                  {getThumbnailSrc}
                  onToggle={toggleMergeSelection}
                  selected={selectedForMerge.includes(person.id)}
                  testId="people-tab-category-statue-item"
                />
              {/each}
            </Accordion.Content>
          </Accordion.Item>
        {/if}

        {#if people.categoryPaintings.length > 0 && dev}
          <Accordion.Item value="cat-painting" data-testid="people-tab-category-painting-section">
            <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
              Malby ({people.categoryPaintings.length})
            </Accordion.Trigger>
            <Accordion.Content class="mb-2 px-4 grid grid-cols-3 gap-2 pt-2 pb-1">
              {#each people.categoryPaintings as person (person.id)}
                <CategoryPersonCard
                  {person}
                  {getThumbnailSrc}
                  onToggle={toggleMergeSelection}
                  selected={selectedForMerge.includes(person.id)}
                  testId="people-tab-category-painting-item"
                />
              {/each}
            </Accordion.Content>
          </Accordion.Item>
        {/if}
      </Accordion.Root>
    </div>
  </Sidebar.Content>
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

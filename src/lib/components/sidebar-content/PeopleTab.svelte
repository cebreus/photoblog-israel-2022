<script lang="ts">
  import { dev } from "$app/environment";
  import PersonDetailDialog from "$lib/components/PersonDetailDialog.svelte";
  import PersonMergeDialog from "$lib/components/PersonMergeDialog.svelte";
  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Switch } from "$lib/components/ui/switch";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";
  import { selectedPeople } from "$lib/stores/filters";
  import { peopleBase, peopleWithStats } from "$lib/stores/people-store";
  import type { Person } from "$lib/types/manifest";
  import { getVisiblePeople } from "$lib/utils/people";
  import Check from "lucide-svelte/icons/check";
  import CheckCheck from "lucide-svelte/icons/check-check";
  import EyeOff from "lucide-svelte/icons/eye-off";
  import Loader2 from "lucide-svelte/icons/loader-2";
  import Merge from "lucide-svelte/icons/merge";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import User from "lucide-svelte/icons/user";
  import X from "lucide-svelte/icons/x";
  import XCircle from "lucide-svelte/icons/x-circle";

  // Subscribe to derived store with optimized stats
  let people = $derived($peopleWithStats);

  // Determine URL prefix from first available image source path
  const photoDaysStore = peopleBase.photoDays;
  const photoDays = $derived($photoDaysStore);
  const firstImage = $derived(photoDays.flatMap((d) => d.items).find((i) => i.type === "image"));

  // Extract prefix from sources[].path which contains full path like "/egypt-2025/images/..."
  const urlPrefix = $derived((() => {
    let prefix = "";
    if (firstImage && (firstImage as any).sources && (firstImage as any).sources.length > 0) {
      const firstPath = (firstImage as any).sources[0].path;
      if (firstPath && firstPath.startsWith("/")) {
        // Path format: "/egypt-2025/images/previews/..." -> extract "/egypt-2025"
        const parts = firstPath.split("/");
        if (parts.length > 2) {
          prefix = `/${parts[1]}`;
        }
      }
    }
    return prefix;
  })());

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

  function openPersonDetail(person: Person, e: MouseEvent) {
    e.stopPropagation();
    detailPerson = person;
    showPersonDetail = true;
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

    console.log("[DEBUG] Starting rename, setting isSaving to true");
    isSaving = true;
    console.log("[DEBUG] isSaving is now:", isSaving);

    try {
      console.log("[DEBUG] Calling API...");
      // Add minimum delay to keep overlay visible
      await Promise.all([
        renamePerson(editingPersonId, editingName.trim()),
        new Promise((resolve) => setTimeout(resolve, 500)), // Min 500ms delay
      ]);
      console.log("[DEBUG] API call successful, triggering reload");
      // Trigger reload to show updated name
      await peopleBase.refresh();
      cancelEditing();
    } catch (error) {
      console.error("Failed to rename person:", error);
    } finally {
      console.log("[DEBUG] Setting isSaving to false");
      isSaving = false;
      console.log("[DEBUG] isSaving is now:", isSaving);
    }
  }

  function togglePerson(personId: string) {
    selectedPeople.update((current) => {
      // SAME LOGIC AS AUTHORS:
      // - Empty array [] = ALL selected (default)
      // - ["none"] = NONE selected
      // - Specific IDs = only those selected

      let effectiveCurrent = current;

      // If empty, treat as "all selected"
      if (current.length === 0) {
        effectiveCurrent = visiblePeople.map((p) => p.id);
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

      const allPeopleIds = visiblePeople.map((p) => p.id);

      // If nothing selected, use special "none" marker
      if (next.length === 0) {
        return ["none"];
      }

      // If all selected, return empty array (default state)
      if (next.length === allPeopleIds.length) {
        return [];
      }

      return next;
    });
  }

  async function toggleIgnore(personId: string) {
    console.log("[DEBUG] Toggling ignore for person:", personId);
    isSaving = true;

    try {
      // Call API to toggle ignored flag
      const response = await fetch("/api/people/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[DEBUG] Person ignored state:", data.ignored);

        // Also remove from selection if being ignored
        selectedPeople.update((sel) => sel.filter((id) => id !== personId));

        // Add minimum delay to show loading state
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Trigger reload to update UI
        await peopleBase.refresh();
      }
    } catch (error) {
      console.error("Failed to toggle ignore:", error);
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
    selectedPeople.set([]);
  }

  function selectAll() {
    // Select all people = show ONLY photos with people (hide photos without people)
    const allPeopleIds = visiblePeople.map((p) => p.id);
    selectedPeople.set(allPeopleIds);
  }

  function selectNone() {
    selectedPeople.set(["none"]);
  }

  // Filter people by ignored flag from manifest AND hide empty profiles (result of merge)
  const visiblePeople = $derived(getVisiblePeople(people));

  const ignoredPeopleList = $derived(people.filter((p) => p.ignored));

  // Track quick filter preset for button group highlighting
  const selectionMode = $derived.by(() => {
    const selected = $selectedPeople;
    const visibleIds = visiblePeople.map((p) => p.id);

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

  async function bulkIgnore() {
    if (selectedForMerge.length === 0) return;

    // Confirmation
    if (!confirm(`Opravdu chcete ignorovat ${selectedForMerge.length} osob?`)) return;

    isSaving = true;
    try {
      console.log("[BULK IGNORE] Ignoring:", selectedForMerge);

      // Execute all requests in parallel
      await Promise.all(
        selectedForMerge.map((id) =>
          fetch("/api/people/ignore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personId: id }),
          }),
        ),
      );

      // Success - remove from selection store if selected
      const ignoredIds = [...selectedForMerge];
      selectedPeople.update((sel) => sel.filter((id) => !ignoredIds.includes(id)));

      // Reset checkbox selection
      selectedForMerge = [];

      // Add delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reload
      await peopleBase.refresh();
    } catch (error) {
      console.error("Bulk ignore failed:", error);
      alert("Hromadné ignorování selhalo.");
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
    // We access 'people' which is $derived($peopleWithStats)
    const selectedPeopleData = people.filter((p) => selectedForMerge.includes(p.id));
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

    console.log(
      "[MERGE UI] Merging",
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
          const error = await response.json();
          throw new Error(`Merge failed for ${source.name}: ${error.error}`);
        }
      }

      console.log("[MERGE UI] All merges successful");

      // Add delay for loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Clear merge state
      selectedForMerge = [];
      showMergeConfirmDialog = false;

      // Trigger reload
      await peopleBase.refresh();
    } catch (error) {
      console.error("[MERGE UI] Failed to merge people:", error);
      alert(`Sloučení selhalo: ${error}`);
    } finally {
      isSaving = false;
    }
  }

  // ... rest of the file ...
  // Wait, I need to make sure person detail uses the refresh too
  // Oh, the template uses `detailPerson` which is local state.
  // The `onUpdate` prop should trigger refresh.
</script>

<div class="contents" data-testid="people-tab">
  <Sidebar.Content>
    <div class="p-4 border-b space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm" data-testid="people-tab-title">Lidé ({people.length})</h3>
      </div>

      <!-- Control buttons -->
      <ToggleGroup
        type="single"
        value={selectionMode || undefined}
        onValueChange={(v) => v && handleSelectionPreset(v as "all" | "none" | "reset")}
        variant="outline"
        size="sm"
        class="w-full"
      >
        <ToggleGroupItem value="all" class="h-7 text-xs" data-testid="people-tab-select-all">
          <CheckCheck class="w-3 h-3 mr-1" /> Vše
        </ToggleGroupItem>
        <ToggleGroupItem value="none" class="h-7 text-xs" data-testid="people-tab-select-none">
          <XCircle class="w-3 h-3 mr-1" /> Žádné
        </ToggleGroupItem>
        <ToggleGroupItem value="reset" class="h-7 text-xs" data-testid="people-tab-reset">
          <X class="w-3 h-3 mr-1" /> Reset
        </ToggleGroupItem>
      </ToggleGroup>

      <p class="text-xs text-muted-foreground">
        <strong>Vše:</strong> Jen fotky s lidmi. <strong>Žádné:</strong> Jen fotky bez lidí.
        <strong>Reset:</strong> Všechny fotky.
      </p>
    </div>

    <div class="flex flex-col">
      {#each visiblePeople as person (person.id)}
        {@const isSelected =
          $selectedPeople.length === 0
            ? true // Empty = all selected
            : $selectedPeople.includes("none")
              ? false // "none" = nothing selected
              : $selectedPeople.includes(person.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class={`relative group border-b flex items-center gap-3 p-3 px-4 hover:bg-accent/50 transition-colors cursor-pointer ${isSelected ? "bg-accent/30" : ""}`}
          onclick={() => !editingPersonId && togglePerson(person.id)}
          data-testid="people-tab-person-item"
        >
          <!-- Loading overlay -->
          {#if isSaving && editingPersonId === person.id}
            {@const _ = console.log(
              "[DEBUG] Rendering overlay for person:",
              person.id,
              "isSaving:",
              isSaving,
            )}
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
                class="font-medium text-sm w-full text-left hover:text-primary transition-colors"
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
              class="ml-2"
              data-testid="people-tab-person-merge-checkbox"
            />
            <Button
              variant="ghost"
              size="icon"
              onclick={(e) => {
                e.stopPropagation();
                toggleIgnore(person.id);
              }}
              class="h-8 w-8"
              title="Ignorovat tuto osobu"
              data-testid="people-tab-person-ignore-button"
            >
              <Trash2 class="w-4 h-4" />
            </Button>
          {/if}
        </div>
      {/each}

      {#if visiblePeople.length === 0}
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
        <div class="px-4 pb-4 flex gap-2">
          {#if selectedForMerge.length >= 2}
            <Button
              variant="default"
              size="sm"
              onclick={openMergeDialog}
              class="flex-1"
              data-testid="people-tab-merge-button"
            >
              <Merge class="w-4 h-4 mr-2" />
              Sloučit ({selectedForMerge.length})
            </Button>
          {/if}

          <Button
            variant="secondary"
            size="sm"
            onclick={bulkIgnore}
            class="flex-1"
            data-testid="people-tab-bulk-ignore-button"
          >
            <EyeOff class="w-4 h-4 mr-2" />
            Ignorovat ({selectedForMerge.length})
          </Button>
        </div>
      {/if}

      <!-- Ignored People Section -->
      {#if ignoredPeopleList.length > 0 && dev}
        {@const ignoredPersons = ignoredPeopleList}
        <Accordion.Root
          type="single"
          value="ignored"
          class="border-t mt-4"
          data-testid="people-tab-ignored-section"
        >
          <Accordion.Item value="ignored">
            <Accordion.Trigger class="px-4 py-3 text-sm font-medium">
              Ignorované osoby ({ignoredPeopleList.length})
            </Accordion.Trigger>
            <Accordion.Content class="border-b mb-2 px-4">
              <div class="space-y-1 pt-2 pb-1">
                {#each ignoredPersons as person (person.id)}
                  <div
                    class="flex items-center gap-2 p-2 rounded bg-slate-50 dark:bg-slate-900/50 text-xs"
                    data-testid="people-tab-ignored-person-item"
                  >
                    <div
                      class="w-6 h-6 rounded overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0"
                    >
                      {#if person.thumbnail}
                        <img
                          src={getThumbnailSrc(person)}
                          alt={person.name}
                          class="w-full h-full object-cover opacity-50"
                        />
                      {:else}
                        <div class="flex items-center justify-center w-full h-full">
                          <User class="w-3 h-3 text-slate-400" />
                        </div>
                      {/if}
                    </div>
                    <span class="flex-1 truncate text-muted-foreground">{person.name}</span>
                    <button
                      class="text-xs text-primary hover:underline"
                      onclick={() => toggleIgnore(person.id)}
                      data-testid="people-tab-ignored-person-restore-button"
                    >
                      Obnovit
                    </button>
                  </div>
                {/each}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      {/if}
    </div>
  </Sidebar.Content>
  <!-- Merge Confirm Dialog -->
  {#if selectedForMerge.length >= 2}
    {@const selectedPeopleData = [...people]
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
      {@const sourcePerson = selectedPeopleData[1]}

      <PersonMergeDialog
        bind:open={showMergeConfirmDialog}
        {sourcePerson}
        {targetPerson}
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
        await peopleBase.refresh();
      }}
    />
  {/if}
</div>

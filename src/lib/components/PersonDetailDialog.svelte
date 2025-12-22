<script lang="ts">
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Search from "@lucide/svelte/icons/search";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import User from "@lucide/svelte/icons/user";
  import { toast } from "svelte-sonner";

  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { createLogger } from "$lib/logger";
  import { people } from "$lib/stores/people.svelte";
  import type { ImageEntry, Person } from "$lib/types/manifest";

  import SelectionBulkActions from "./SelectionBulkActions.svelte";

  const logger = createLogger("PersonDetailDialog");

  let {
    open = $bindable(false),
    person,
    urlPrefix,
    onUpdate,
  } = $props<{
    open: boolean;
    person: Person;
    urlPrefix: string;
    onUpdate?: () => void;
  }>();

  const personImages = $derived.by(() => {
    if (!person || !open) return [];
    // Use reactive store instead of static getter
    const days = people.photoDays;
    const images: ImageEntry[] = [];
    for (const day of days) {
      for (const item of day.items) {
        if (item.type === "image" && item.people?.includes(person.id)) {
          images.push(item as ImageEntry);
        }
      }
    }
    return images;
  });

  const crops = $derived(
    personImages.map((img) => {
      // Find the index of the person in the parallel arrays
      const personIndex = img.people?.indexOf(person.id) ?? -1;
      const box =
        personIndex !== -1 && img.analysis?.faces ? img.analysis.faces[personIndex] : undefined;

      return {
        id: img.id,
        src: `${urlPrefix}/faces/${person.id}/${img.id}.jpg`,
        original: img,
        box,
      };
    }),
  );

  let isWorking = $state(false);
  let selectedIds = $state<Set<string>>(new Set());
  let showReassignDialog = $state(false);
  let personSearchQuery = $state("");

  const filteredPeople = $derived.by(() => {
    if (!open) return [];
    return people.peopleWithStats
      .filter((p) => p.id !== person.id && !p.ignored)
      .filter((p) => p.name.toLowerCase().includes(personSearchQuery.toLowerCase()))
      .sort((a, b) => b.faceCount - a.faceCount)
      .slice(0, 20);
  });

  function toggleSelection(imageId: string) {
    if (selectedIds.has(imageId)) {
      selectedIds.delete(imageId);
    } else {
      selectedIds.add(imageId);
    }
    selectedIds = new Set(selectedIds); // Trigger reactivity
  }

  function selectAll() {
    selectedIds = new Set(crops.map((c) => c.id));
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  async function unmatchFace(imageId: string, shouldHide = false) {
    await performUnmatch([imageId], shouldHide);
  }

  async function unmatchSelected(shouldHide = false) {
    const count = selectedIds.size;
    if (count === 0) return;

    await performUnmatch(Array.from(selectedIds), shouldHide);
    selectedIds = new Set();
  }

  async function performUnmatch(imageIds: string[], shouldHide = false) {
    isWorking = true;
    try {
      const res = await fetch("/api/people/unmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, imageIds, ignore: shouldHide }),
      });

      if (res.ok) {
        // Trigger update in parent
        onUpdate?.();
        toast.success(
          shouldHide
            ? `Fotky (${imageIds.length}) byly úspěšně skryty.`
            : `Fotky (${imageIds.length}) byly úspěšně vyjmuty.`,
          { duration: 5000 },
        );
      } else {
        toast.error("Chyba při zpracování požadavku", {
          description: "Operace se nezdařila. Zkuste to prosím znovu.",
          duration: 10000,
        });
      }
    } catch (e) {
      logger.error(e as Error);
      toast.error("Chyba komunikace", {
        description: "Nelze kontaktovat server.",
        duration: 10000,
      });
    } finally {
      isWorking = false;
    }
  }

  async function ignoreDetection(crop: (typeof crops)[0]) {
    if (!crop.box) {
      toast.error("Chyba dat", { description: "Nepodařilo se najít souřadnice detekce." });
      return;
    }

    isWorking = true;
    try {
      const res = await fetch("/api/people/ignore-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: person.id,
          imageId: crop.id,
          box: crop.box,
        }),
      });

      if (res.ok) {
        onUpdate?.();
        toast.success("Detekce byla označena jako neplatná a bude v budoucnu ignorována.");
      } else {
        const data = await res.json();
        toast.error("Chyba", { description: data.error || "Nepodařilo se uložit nastavení." });
      }
    } catch (e) {
      logger.error(e);
      toast.error("Chyba komunikace");
    } finally {
      isWorking = false;
    }
  }

  async function updateCategory(category: "person" | "statue" | "painting") {
    isWorking = true;
    try {
      const res = await fetch("/api/people/update-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, category }),
      });

      if (res.ok) {
        onUpdate?.();
        toast.success(
          `Kategorie změněna na ${category === "person" ? "Osoba" : category === "statue" ? "Socha" : "Malba"}.`,
        );
      } else {
        toast.error("Chyba při změně kategorie.");
      }
    } catch (e) {
      logger.error(e);
      toast.error("Chyba komunikace");
    } finally {
      isWorking = false;
    }
  }

  async function assignToPerson(targetPerson: Person) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    isWorking = true;
    try {
      const res = await fetch("/api/people/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePersonId: person.id,
          targetPersonId: targetPerson.id,
          imageIds: ids,
        }),
      });

      if (res.ok) {
        onUpdate?.();
        selectedIds = new Set();
        showReassignDialog = false;
        toast.success(`Fotky byly přiřazeny osobě ${targetPerson.name}.`);
      } else {
        const data = await res.json();
        toast.error("Chyba přiřazení", { description: data.error });
      }
    } catch (e) {
      logger.error(e);
      toast.error("Chyba komunikace");
    } finally {
      isWorking = false;
    }
  }

  async function ignoreSelectedDetections() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (
      !confirm(
        `Opravdu označit ${ids.length} vybraných detekcí jako 'není osoba'? Budou navždy ignorovány.`,
      )
    ) {
      return;
    }

    isWorking = true;
    try {
      const selectedCrops = crops.filter((c) => selectedIds.has(c.id));
      await Promise.all(
        selectedCrops.map((crop) => {
          if (!crop.box) return Promise.resolve();
          return fetch("/api/people/ignore-face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personId: person.id,
              imageId: crop.id,
              box: crop.box,
            }),
          });
        }),
      );

      onUpdate?.();
      selectedIds = new Set();
      toast.success("Vybrané detekce byly označeny jako neplatné a budou ignorovány.");
    } catch (e) {
      logger.error("Bulk mark-as-junk failed:", e);
      toast.error("Chyba při hromadném označování detekcí.");
    } finally {
      isWorking = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="max-w-5xl min-w-3xl h-[80vh] flex flex-col p-0 gap-0"
    data-testid="person-detail-dialog-content"
  >
    <Dialog.Header class="px-6 py-4 border-b" data-testid="person-detail-dialog-header">
      <div class="flex items-center justify-between">
        <Dialog.Title class="flex items-center gap-2" data-testid="person-detail-dialog-title">
          {#if person.thumbnail}
            <img
              src={`${urlPrefix}/${person.thumbnail}`}
              class="w-8 h-8 rounded-full object-cover"
              alt={person.name}
              data-testid="person-detail-header-thumbnail"
            />
          {/if}
          <span data-testid="person-detail-header-name">{person.name}</span>

          <span
            class="text-muted-foreground font-normal text-sm ml-1"
            data-testid="person-detail-header-count"
          >
            ({crops.length} detekcí)
          </span>
        </Dialog.Title>
      </div>
      <Dialog.Description class="sr-only">
        Detail osoby a všechny detekované tváře
      </Dialog.Description>
    </Dialog.Header>

    <div
      class="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50"
      data-testid="person-detail-dialog-body"
    >
      {#if crops.length === 0}
        <div
          class="flex items-center justify-center h-full text-muted-foreground"
          data-testid="person-detail-empty-state"
        >
          Žádné detekované tváře. (Možná běží clustering nebo refresh dat?)
        </div>
      {:else}
        <!-- Grid layout with Cards (No overlaps) -->
        <div
          class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4"
          data-testid="person-detail-crop-grid"
        >
          {#each crops as crop}
            {@const isSelected = selectedIds.has(crop.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class={`flex flex-col bg-background rounded-lg shadow-sm border overflow-hidden transition-all cursor-pointer relative ${isSelected ? "ring-2 ring-blue-500 border-blue-500" : "hover:border-primary/50"}`}
              data-testid={`person-detail-crop-item-${crop.id}`}
              onclick={() => toggleSelection(crop.id)}
            >
              <!-- Selection Indicator (Like PhotoGridItem) -->
              <div class="absolute top-2 right-2 z-10" data-testid="person-detail-crop-checkbox">
                <div
                  class={`h-6 w-6 rounded border border-white ${isSelected ? "bg-blue-500" : "bg-black/50"} flex shrink-0 items-center justify-center`}
                  data-testid={`person-detail-crop-checkbox-indicator-${crop.id}`}
                >
                  {#if isSelected}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg
                    >
                  {/if}
                </div>
              </div>

              <!-- Image Area -->
              <div class="aspect-square relative group overflow-hidden">
                <img
                  src={crop.src}
                  alt="Face crop"
                  class={`w-full h-full object-cover transition-opacity ${isSelected ? "opacity-90" : ""}`}
                  loading="lazy"
                  data-testid={`person-detail-crop-image-${crop.id}`}
                />
              </div>

              <!-- Footer Info -->
              <div
                class="p-2 border-t flex flex-col gap-1 bg-muted/10 items-center"
                data-testid="person-detail-crop-footer"
              >
                <span
                  class="font-mono text-[10px] text-muted-foreground w-full truncate text-center"
                  title={crop.id}
                  data-testid="person-detail-crop-id"
                >
                  {crop.id}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <Dialog.Footer
      class="px-6 py-4 border-t bg-muted/20 flex items-center justify-between"
      data-testid="person-detail-dialog-footer"
    >
      {#if crops.length > 0 && selectedIds.size === 0}
        <div class="flex items-center gap-2 mr-auto" data-testid="person-detail-header-actions">
          <Button
            variant="ghost"
            size="sm"
            onclick={selectAll}
            data-testid="person-detail-select-all-btn"
          >
            <CheckCheck class="w-3.5 h-3.5 mr-1" /> Vybrat vše
          </Button>
        </div>
      {:else}
        <div class="mr-auto"></div>
      {/if}

      {#if selectedIds.size > 0}
        <SelectionBulkActions
          count={selectedIds.size}
          onClear={clearSelection}
          {isWorking}
          class="z-10"
          testId="person-detail-bulk-actions"
          onMarkAsJunk={ignoreSelectedDetections}
          onUpdateCategory={updateCategory}
        >
          {#snippet actions()}
            <Button
              variant="outline"
              size="sm"
              onclick={() => {
                personSearchQuery = "";
                showReassignDialog = true;
              }}
              disabled={isWorking}
              class="flex-1"
              data-testid="person-detail-bulk-assign-btn"
            >
              <User class="w-4 h-4 mr-2" />
              Přiřadit k...
            </Button>

            <Button
              variant="outline"
              size="sm"
              onclick={() => unmatchSelected(true)}
              disabled={isWorking}
              class="flex-1"
              data-testid="person-detail-bulk-ignore-btn"
            >
              <EyeOff class="w-4 h-4 mr-2" />
              Skrýt
            </Button>

            <Button
              variant="outline"
              size="sm"
              onclick={() => unmatchSelected(false)}
              disabled={isWorking}
              class="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              data-testid="person-detail-bulk-unmatch-btn"
            >
              {#if isWorking}
                <Loader2 class="w-4 h-4 mr-2 animate-spin" />
              {:else}
                <Trash2 class="w-4 h-4 mr-2" />
                Vyjmout
              {/if}
            </Button>
          {/snippet}
        </SelectionBulkActions>
      {/if}

      <Button
        variant="outline"
        size="sm"
        onclick={() => (open = false)}
        disabled={isWorking}
        data-testid="person-detail-close-btn"
      >
        Zavřít
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Secondary Dialog for Reassignment Selection -->
<Dialog.Root bind:open={showReassignDialog}>
  <Dialog.Content class="max-w-md p-0 gap-0" data-testid="reassign-selection-dialog">
    <Dialog.Header class="px-6 py-4 border-b">
      <Dialog.Title>Přiřadit k osobě</Dialog.Title>
      <Dialog.Description>Vyberte osobu, ke které chcete přiřadit vybrané tváře.</Dialog.Description
      >
    </Dialog.Header>

    <div class="p-4 border-b bg-muted/20">
      <div class="relative">
        <Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          bind:value={personSearchQuery}
          placeholder="Hledat osobu..."
          class="w-full pl-9 pr-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
          data-testid="reassign-search-input"
        />
      </div>
    </div>

    <div class="max-h-75 overflow-y-auto p-2" data-testid="reassign-person-list">
      {#each filteredPeople as p}
        <button
          class="w-full flex items-center gap-3 p-2 hover:bg-accent rounded-md transition-colors text-left"
          onclick={() => assignToPerson(p)}
          data-testid={`reassign-person-option-${p.id}`}
        >
          {#if p.thumbnail}
            <img
              src={`${urlPrefix}/${p.thumbnail}`}
              class="w-8 h-8 rounded-full object-cover shrink-0"
              alt={p.name}
            />
          {:else}
            <div
              class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0"
            >
              <User class="w-4 h-4 text-muted-foreground" />
            </div>
          {/if}
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{p.name}</div>
            <div class="text-[10px] text-muted-foreground">{p.faceCount} fotek</div>
          </div>
        </button>
      {:else}
        <div class="p-8 text-center text-muted-foreground text-sm">
          Žádné osoby neodpovídají hledání.
        </div>
      {/each}
    </div>

    <Dialog.Footer class="px-6 py-4 border-t bg-muted/20">
      <Button variant="outline" onclick={() => (showReassignDialog = false)}>Zrušit</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

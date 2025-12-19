<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { people } from "$lib/stores/people.svelte";
  import type { ImageEntry, Person } from "$lib/types/manifest";
  import Check from "lucide-svelte/icons/check";
  import CheckCheck from "lucide-svelte/icons/check-check";
  import Loader2 from "lucide-svelte/icons/loader-2";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import X from "lucide-svelte/icons/x";

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
    personImages.map((img) => ({
      id: img.id,
      src: `${urlPrefix}/faces/${person.id}/${img.id}.jpg`,
      original: img,
    })),
  );

  let isWorking = $state(false);
  let selectedIds = $state<Set<string>>(new Set());

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

  async function unmatchFace(imageId: string) {
    if (!confirm("Opravdu vyjmout tuto fotku? Vytvoří se nová osoba 'Odpojeno...'.")) return;
    await performUnmatch([imageId]);
  }

  async function unmatchSelected() {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(`Opravdu vyjmout ${count} fotek? Vytvoří se nové osoby 'Odpojeno...'.`)) return;

    await performUnmatch(Array.from(selectedIds));
    selectedIds = new Set();
  }

  async function performUnmatch(imageIds: string[]) {
    isWorking = true;
    try {
      const res = await fetch("/api/people/unmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, imageIds }),
      });

      if (res.ok) {
        // Trigger update in parent
        onUpdate?.();
      } else {
        alert("Chyba při oddělování fotek.");
      }
    } catch (e) {
      console.error(e);
      alert("Chyba komunikace.");
    } finally {
      isWorking = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
    <Dialog.Header class="px-6 py-4 border-b">
      <div class="flex items-center justify-between">
        <Dialog.Title class="flex items-center gap-2" data-testid="person-detail-dialog-title">
          {#if person.thumbnail}
            <img
              src={`${urlPrefix}/${person.thumbnail}`}
              class="w-8 h-8 rounded-full object-cover"
              alt={person.name}
            />
          {/if}
          {person.name}
          <span class="text-muted-foreground font-normal text-sm ml-2">
            ({crops.length} detekcí)
          </span>
        </Dialog.Title>

        {#if crops.length > 0}
          <div class="flex items-center gap-2">
            {#if selectedIds.size > 0}
              <Button variant="outline" size="sm" onclick={clearSelection} class="h-8 rounded-full">
                <X class="w-3 h-3 mr-1" /> Zrušit výběr ({selectedIds.size})
              </Button>
            {:else}
              <Button variant="ghost" size="sm" onclick={selectAll} class="h-8 rounded-full">
                <CheckCheck class="w-3 h-3 mr-1" /> Vybrat vše
              </Button>
            {/if}
          </div>
        {/if}
      </div>
      <Dialog.Description class="sr-only">
        Detail osoby a všechny detekované tváře
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
      {#if crops.length === 0}
        <div class="flex items-center justify-center h-full text-muted-foreground">
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
              class={`flex flex-col bg-background rounded-lg shadow-sm border overflow-hidden transition-all cursor-pointer relative ${isSelected ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/50"}`}
              data-testid="person-detail-crop-item"
              onclick={() => toggleSelection(crop.id)}
            >
              <!-- Selection Indicator -->
              {#if isSelected}
                <div
                  class="absolute top-2 left-2 z-10 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm"
                >
                  <Check class="w-3 h-3" />
                </div>
              {/if}

              <!-- Image Area -->
              <div class="aspect-square relative group">
                <img
                  src={crop.src}
                  alt="Face crop"
                  class={`w-full h-full object-cover transition-opacity ${isSelected ? "opacity-90" : ""}`}
                  loading="lazy"
                />
              </div>

              <!-- Footer Controls (Separated) -->
              <div class="p-2 border-t flex items-center justify-between gap-2 bg-muted/10">
                <span
                  class="font-mono text-[10px] text-muted-foreground break-all truncate flex-1"
                  title={crop.id}
                >
                  {crop.id}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive"
                  title="Odstranit (Vytvořit novou osobu)"
                  onclick={(e) => {
                    e.stopPropagation();
                    unmatchFace(crop.id);
                  }}
                  data-testid="person-detail-crop-unmatch"
                >
                  <Trash2 class="w-4 h-4" />
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <Dialog.Footer class="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
      <div class="flex items-center gap-2">
        {#if selectedIds.size > 0}
          <Button
            variant="destructive"
            onclick={unmatchSelected}
            disabled={isWorking}
            class="shadow-sm"
          >
            {#if isWorking}
              <Loader2 class="w-4 h-4 mr-2 animate-spin" />
              Pracuji...
            {:else}
              <Trash2 class="w-4 h-4 mr-2" />
              Vyjmout vybrané ({selectedIds.size})
            {/if}
          </Button>
        {/if}
      </div>
      <Button variant="outline" onclick={() => (open = false)} disabled={isWorking}>Zavřít</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

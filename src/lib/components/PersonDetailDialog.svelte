<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { peopleBase } from "$lib/stores/people-store";
  import type { ImageEntry, Person } from "$lib/types/manifest";
  import Trash2 from "lucide-svelte/icons/trash-2";

  const photoDaysStore = peopleBase.photoDays;

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
    const days = $photoDaysStore;
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

  async function unmatchFace(imageId: string) {
    if (!confirm("Opravdu vyjmout tuto fotku? Vytvoří se nová osoba 'Odpojeno...'.")) return;

    try {
      const res = await fetch("/api/people/unmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, imageId }),
      });

      if (res.ok) {
        // Trigger update in parent
        onUpdate?.();
        // Optimistically remove from view if we want, but reload is safer
        // Actually since personImages is derived from getPhotoDays, and getPhotoDays is NOT reactive to API...
        // We rely on parent reloading data.
      } else {
        alert("Chyba při oddělování fotky.");
      }
    } catch (e) {
      console.error(e);
      alert("Chyba komunikace.");
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
    <Dialog.Header class="px-6 py-4 border-b">
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
        <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4" data-testid="person-detail-crop-grid">
          {#each crops as crop}
            <div class="flex flex-col bg-background rounded-lg shadow-sm border overflow-hidden" data-testid="person-detail-crop-item">
              <!-- Image Area -->
              <div class="aspect-square relative group">
                <img
                  src={crop.src}
                  alt="Face crop"
                  class="w-full h-full object-cover"
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
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive"
                  title="Odstranit (Vytvořit novou osobu)"
                  onclick={() => unmatchFace(crop.id)}
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

    <Dialog.Footer class="px-6 py-4 border-t bg-muted/20">
      <Button variant="outline" onclick={() => (open = false)}>Zavřít</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

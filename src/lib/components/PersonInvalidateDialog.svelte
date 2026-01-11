<script lang="ts">
  import { User } from "@lucide/svelte";

  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Spinner } from "$lib/components/ui/spinner";
  import { createLogger } from "$lib/logger";

  const logger = createLogger("PersonInvalidateDialog");

  type Crop = {
    id: string;
    src: string;
    personId: string;
    personName: string;
    box?: { x: number; y: number; width: number; height: number };
  };

  let {
    open = $bindable(false),
    candidates = [],
    urlPrefix = "",
    onConfirm,
  } = $props<{
    open?: boolean;
    candidates: Crop[];
    urlPrefix?: string;
    onConfirm: () => Promise<void>;
  }>();

  let isLoading = $state(false);

  async function handleConfirm() {
    isLoading = true;
    try {
      await onConfirm();
      open = false;
    } catch (error) {
      logger.error({ err: error }, "Invalidation failed");
    } finally {
      isLoading = false;
    }
  }

  const peopleCount = $derived(new Set(candidates.map((c: Crop) => c.personId)).size);
  let failedImages = $state(new Set<string>());
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-4xl gap-0 p-0">
    <Dialog.Header class="border-b px-6 py-4">
      <Dialog.Title data-testid="person-invalidate-dialog-title">Zneplatnit detekce</Dialog.Title>
      <Dialog.Description data-testid="person-invalidate-dialog-description">
        Opravdu chcete označit tyto detekce jako <strong>"není tvář"</strong>?
        <br />
        Tato akce odstraní <strong>{candidates.length}</strong> tváří od
        <strong>{peopleCount}</strong> osob. Osoby s 0 tvářemi budou následně smazány.
      </Dialog.Description>
    </Dialog.Header>

    <div class="h-[60vh] overflow-y-auto bg-slate-50 p-6 dark:bg-slate-900/50">
      <div class="flex flex-wrap gap-2">
        {#each candidates as crop (crop.id + crop.personId)}
          <div class="bg-background flex items-center gap-2 rounded border p-2 pr-3 shadow-sm">
            <div
              class="bg-muted flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded"
            >
              {#if failedImages.has(crop.id + crop.personId)}
                <User class="text-muted-foreground/50 h-6 w-6" />
              {:else}
                <img
                  src={crop.src}
                  alt="Face crop"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  onerror={() => failedImages.add(crop.id + crop.personId)}
                />
              {/if}
            </div>
            <div class="max-w-[120px]">
              <div class="truncate text-xs font-medium" title={crop.personName}>
                {crop.personName}
              </div>
              <div class="text-muted-foreground truncate text-[10px]">{crop.id}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <Dialog.Footer class="bg-muted/20 border-t px-6 py-4">
      <Button
        variant="outline"
        onclick={() => (open = false)}
        disabled={isLoading}
        data-testid="person-invalidate-cancel">Zrušit</Button
      >
      <Button
        onclick={handleConfirm}
        disabled={isLoading}
        variant="destructive"
        data-testid="person-invalidate-confirm"
      >
        {#if isLoading}
          <Spinner class="mr-2 h-4 w-4" />
          Zpracovávám...
        {:else}
          Zneplatnit vše
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

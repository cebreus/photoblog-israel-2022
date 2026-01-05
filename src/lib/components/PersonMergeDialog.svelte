<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";

  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Spinner } from "$lib/components/ui/spinner";
  import { createLogger } from "$lib/logger";
  import type { Person } from "$lib/types/manifest";

  const logger = createLogger("PersonMergeDialog");

  let {
    open = $bindable(false),
    sources,
    targetPerson,
    urlPrefix = "",
    onConfirm,
  } = $props<{
    open?: boolean;
    sources: Person[];
    targetPerson: Person;
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
      logger.error({ err: error }, "Merge failed");
    } finally {
      isLoading = false;
    }
  }

  // Get thumbnail URL
  function getThumbnailUrl(person: Person): string {
    if (!person.thumbnail) return "";
    if (person.thumbnail.startsWith("/")) return person.thumbnail;
    // Use urlPrefix if available
    return `${urlPrefix}/${person.thumbnail}`;
  }

  const totalSourceFaces = $derived(
    sources.reduce((sum: number, p: Person) => sum + p.faceCount, 0),
  );
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-2xl gap-0 p-0">
    <Dialog.Header class="border-b px-6 py-4">
      <Dialog.Title data-testid="person-merge-dialog-title">Sloučit osoby</Dialog.Title>
      <Dialog.Description data-testid="person-merge-dialog-description">
        Tato akce sloučí vybraných {sources.length} osob do jedné. Všechny jejich fotky budou přiřazeny
        cílové osobě. <strong>Nelze vrátit zpět.</strong>
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-6 p-6">
      <div class="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
        <!-- Source Persons List -->
        <div class="max-h-60 space-y-2 overflow-y-auto pr-2" data-testid="person-merge-sources">
          <h4
            class="text-muted-foreground bg-background sticky top-0 mb-1 pb-1 text-xs font-semibold uppercase"
          >
            Zdrojové osoby ({sources.length})
          </h4>
          <div class="space-y-2">
            {#each sources as source}
              <div
                class="flex items-center gap-3 rounded border border-red-100 bg-red-50 p-2 dark:border-red-900/30 dark:bg-red-900/20"
              >
                {#if source.thumbnail}
                  <img
                    src={getThumbnailUrl(source)}
                    alt={source.name}
                    class="h-10 w-10 rounded object-cover"
                  />
                {:else}
                  <div class="h-10 w-10 rounded bg-slate-200 dark:bg-slate-800"></div>
                {/if}
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">{source.name}</div>
                  <div class="text-muted-foreground text-[10px]">{source.faceCount} fotek</div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Arrow -->
        <div class="text-muted-foreground shrink-0">
          <ArrowRight class="h-6 w-6" />
        </div>

        <!-- Target Person -->
        <div class="self-start" data-testid="person-merge-target">
          <h4 class="text-muted-foreground mb-2 text-xs font-semibold uppercase">
            Cílová osoba (zůstane)
          </h4>
          <div
            class="flex items-center gap-3 rounded-lg border-2 border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
          >
            {#if targetPerson.thumbnail}
              <img
                src={getThumbnailUrl(targetPerson)}
                alt={targetPerson.name}
                class="h-12 w-12 rounded object-cover"
              />
            {:else}
              <div class="h-12 w-12 rounded bg-slate-200 dark:bg-slate-800"></div>
            {/if}
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium" data-testid="person-merge-target-name">
                {targetPerson.name}
              </div>
              <div class="text-muted-foreground text-xs">{targetPerson.faceCount} fotek</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Result Preview -->
      <div class="bg-muted rounded-lg p-4">
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Cílové jméno:</span>
            <span class="font-medium">{targetPerson.name}</span>
          </div>
          <div class="border-muted-foreground/10 mt-1 flex justify-between border-t pt-1">
            <span class="text-muted-foreground">Celkem bude fotek:</span>
            <span class="text-primary font-bold">{totalSourceFaces + targetPerson.faceCount}</span>
          </div>
          <p class="text-muted-foreground mt-2 text-[10px] italic">
            * Zdrojové osoby budou smazány a jejich data (face deskriptory) budou započítány do
            cílového profilu.
          </p>
        </div>
      </div>
    </div>

    <Dialog.Footer class="bg-muted/20 border-t px-6 py-4">
      <Button
        variant="outline"
        onclick={() => (open = false)}
        disabled={isLoading}
        data-testid="person-merge-cancel">Zrušit</Button
      >
      <Button
        onclick={handleConfirm}
        disabled={isLoading}
        variant="destructive"
        data-testid="person-merge-confirm"
      >
        {#if isLoading}
          <Spinner class="mr-2 h-4 w-4" />
          Slučuji...
        {:else}
          Sloučit {sources.length + 1} osob do jedné
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

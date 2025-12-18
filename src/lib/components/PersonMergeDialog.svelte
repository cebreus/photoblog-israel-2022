<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import type { Person } from "$lib/types/manifest";
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import Loader2 from "lucide-svelte/icons/loader-2";

  let {
    open = $bindable(false),
    sourcePerson,
    targetPerson,
    onConfirm,
  } = $props<{
    open?: boolean;
    sourcePerson: Person;
    targetPerson: Person;
    onConfirm: (sourceId: string, targetId: string) => Promise<void>;
  }>();

  let isLoading = $state(false);

  async function handleConfirm() {
    isLoading = true;
    try {
      await onConfirm(sourcePerson.id, targetPerson.id);
      open = false;
    } catch (error) {
      console.error("Merge failed:", error);
    } finally {
      isLoading = false;
    }
  }

  // Get thumbnail URL
  function getThumbnailUrl(person: Person): string {
    if (!person.thumbnail) return "";
    if (person.thumbnail.startsWith("/")) return person.thumbnail;
    // Assume same URL prefix logic as PeopleTab
    return `/${person.thumbnail}`;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title data-testid="person-merge-dialog-title">Sloučit osoby</Dialog.Title>
      <Dialog.Description data-testid="person-merge-dialog-description">
        Tato akce sloučí dvě osoby do jedné. Všechny fotky zdrojové osoby budou přiřazeny cílové
        osobě. <strong>Nelze vrátit zpět.</strong>
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="flex items-center gap-4">
        <!-- Source Person -->
        <div class="flex-1" data-testid="person-merge-source">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Zdrojová osoba (bude smazána)
          </h4>
          <div
            class="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800"
          >
            {#if sourcePerson.thumbnail}
              <img
                src={getThumbnailUrl(sourcePerson)}
                alt={sourcePerson.name}
                class="w-12 h-12 rounded object-cover"
              />
            {:else}
              <div class="w-12 h-12 rounded bg-slate-200 dark:bg-slate-800"></div>
            {/if}
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate" data-testid="person-merge-source-name">{sourcePerson.name}</div>
              <div class="text-xs text-muted-foreground">{sourcePerson.faceCount} fotek</div>
            </div>
          </div>
        </div>

        <!-- Arrow -->
        <div class="flex-shrink-0 text-muted-foreground">
          <ArrowRight class="w-6 h-6" />
        </div>

        <!-- Target Person -->
        <div class="flex-1" data-testid="person-merge-target">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Cílová osoba (bude zachována)
          </h4>
          <div
            class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800"
          >
            {#if targetPerson.thumbnail}
              <img
                src={getThumbnailUrl(targetPerson)}
                alt={targetPerson.name}
                class="w-12 h-12 rounded object-cover"
              />
            {:else}
              <div class="w-12 h-12 rounded bg-slate-200 dark:bg-slate-800"></div>
            {/if}
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate" data-testid="person-merge-target-name">{targetPerson.name}</div>
              <div class="text-xs text-muted-foreground">{targetPerson.faceCount} fotek</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Result Preview -->
      <div class="p-4 bg-muted rounded-lg">
        <div class="text-sm space-y-1">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Po sloučení:</span>
            <span class="font-medium">{targetPerson.name}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Celkem fotek:</span>
            <span class="font-medium">{sourcePerson.faceCount + targetPerson.faceCount}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Thumbnail:</span>
            <span class="font-medium">Z cílové osoby</span>
          </div>
        </div>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)} disabled={isLoading} data-testid="person-merge-cancel">Zrušit</Button>
      <Button onclick={handleConfirm} disabled={isLoading} variant="destructive" data-testid="person-merge-confirm">
        {#if isLoading}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          Slučuji...
        {:else}
          Sloučit
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

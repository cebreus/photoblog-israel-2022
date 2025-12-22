<script lang="ts">
  import type { Person } from "$lib/types/manifest";

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

  let _isLoading = $state(false);

  async function _handleConfirm() {
    _isLoading = true;
    try {
      await onConfirm();
      open = false;
    } catch (_error) {
    } finally {
      _isLoading = false;
    }
  }

  // Get thumbnail URL
  function _getThumbnailUrl(person: Person): string {
    if (!person.thumbnail) return "";
    if (person.thumbnail.startsWith("/")) return person.thumbnail;
    // Use urlPrefix if available
    return `${urlPrefix}/${person.thumbnail}`;
  }

  const _totalSourceFaces = $derived(
    sources.reduce((sum: number, p: Person) => sum + p.faceCount, 0),
  );
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-2xl p-0 gap-0">
    <Dialog.Header class="px-6 py-4 border-b">
      <Dialog.Title data-testid="person-merge-dialog-title">Sloučit osoby</Dialog.Title>
      <Dialog.Description data-testid="person-merge-dialog-description">
        Tato akce sloučí vybraných {sources.length} osob do jedné. Všechny jejich fotky budou přiřazeny
        cílové osobě. <strong>Nelze vrátit zpět.</strong>
      </Dialog.Description>
    </Dialog.Header>

    <div class="p-6 space-y-6">
      <div class="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
        <!-- Source Persons List -->
        <div
          class="space-y-2 max-h-[240px] overflow-y-auto pr-2"
          data-testid="person-merge-sources"
        >
          <h4
            class="text-xs font-semibold text-muted-foreground uppercase mb-1 sticky top-0 bg-background pb-1"
          >
            Zdrojové osoby ({sources.length})
          </h4>
          <div class="space-y-2">
            {#each sources as source}
              <div
                class="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30"
              >
                {#if source.thumbnail}
                  <img
                    src={getThumbnailUrl(source)}
                    alt={source.name}
                    class="w-10 h-10 rounded object-cover"
                  />
                {:else}
                  <div class="w-10 h-10 rounded bg-slate-200 dark:bg-slate-800"></div>
                {/if}
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">{source.name}</div>
                  <div class="text-[10px] text-muted-foreground">{source.faceCount} fotek</div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Arrow -->
        <div class="shrink-0 text-muted-foreground">
          <ArrowRight class="w-6 h-6" />
        </div>

        <!-- Target Person -->
        <div class="self-start" data-testid="person-merge-target">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Cílová osoba (zůstane)
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
              <div class="font-medium truncate" data-testid="person-merge-target-name">
                {targetPerson.name}
              </div>
              <div class="text-xs text-muted-foreground">{targetPerson.faceCount} fotek</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Result Preview -->
      <div class="p-4 bg-muted rounded-lg">
        <div class="text-sm space-y-1">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Cílové jméno:</span>
            <span class="font-medium">{targetPerson.name}</span>
          </div>
          <div class="flex justify-between border-t border-muted-foreground/10 pt-1 mt-1">
            <span class="text-muted-foreground">Celkem bude fotek:</span>
            <span class="font-bold text-primary">{totalSourceFaces + targetPerson.faceCount}</span>
          </div>
          <p class="text-[10px] text-muted-foreground mt-2 italic">
            * Zdrojové osoby budou smazány a jejich data (face deskriptory) budou započítány do
            cílového profilu.
          </p>
        </div>
      </div>
    </div>

    <Dialog.Footer class="px-6 py-4 border-t bg-muted/20">
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
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          Slučuji...
        {:else}
          Sloučit {sources.length + 1} osob do jedné
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

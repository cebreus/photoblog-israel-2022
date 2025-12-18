<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import EyeOff from "lucide-svelte/icons/eye-off";
  import Loader2 from "lucide-svelte/icons/loader-2";

  let {
    open = $bindable(false),
    count,
    onConfirm,
  } = $props<{
    open?: boolean;
    count: number;
    onConfirm: () => Promise<void>;
  }>();

  let isLoading = $state(false);

  async function handleConfirm() {
    isLoading = true;
    try {
      await onConfirm();
      open = false;
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-md p-0 gap-0">
    <Dialog.Header class="px-6 py-4 border-b">
      <Dialog.Title class="flex items-center gap-2" data-testid="ignore-confirm-title">
        <EyeOff class="w-5 h-5 text-muted-foreground" />
        Potvrdit ignorování
      </Dialog.Title>
      <Dialog.Description class="sr-only" data-testid="ignore-confirm-description">
        Potvrzení akce ignorování vybraných osob.
      </Dialog.Description>
    </Dialog.Header>

    <div class="p-6">
      <p class="text-sm text-foreground">
        Opravdu chcete ignorovat <strong
          >{count} {count === 1 ? "osobu" : count > 1 && count < 5 ? "osoby" : "osob"}</strong
        >?
      </p>
      <p class="text-xs text-muted-foreground mt-2">
        Ignorované osoby se přestanou zobrazovat v seznamu "Lidé". Tuto akci lze vrátit v sekci
        "Ignorované osoby".
      </p>
    </div>

    <Dialog.Footer class="px-6 py-4 border-t bg-muted/20">
      <Button
        variant="outline"
        onclick={() => (open = false)}
        disabled={isLoading}
        data-testid="ignore-confirm-cancel">Zrušit</Button
      >
      <Button
        onclick={handleConfirm}
        disabled={isLoading}
        variant="secondary"
        data-testid="ignore-confirm-confirm"
      >
        {#if isLoading}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          Ignoruji...
        {:else}
          Ignorovat
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

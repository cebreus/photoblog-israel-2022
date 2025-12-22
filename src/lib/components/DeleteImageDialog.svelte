<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import type { ImageEntry } from "$lib/types/manifest";

  let {
    open = $bindable(false),
    images,
    isDeleting = false,
    onConfirm,
  }: {
    open: boolean;
    images: ImageEntry[];
    isDeleting?: boolean;
    onConfirm: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content data-testid="delete-image-dialog-content">
    <Dialog.Header>
      <Dialog.Title>Opravdu smazat?</Dialog.Title>
      <Dialog.Description>
        Tato akce je nevratná. Následující soubory budou trvale smazány z disku:
      </Dialog.Description>
    </Dialog.Header>
    <div class="max-h-75 overflow-y-auto my-4 border rounded p-2">
      <ul class="space-y-2">
        {#each images as img}
          <li class="flex items-center gap-3 text-sm">
            <img
              src={img.sources.find((s) => s.variant === "fallback")?.path}
              alt={img.alt}
              class="w-20 h-20 object-cover rounded bg-muted"
            />
            <span class="font-mono text-xs">{img.src.split("/").pop()}</span>
          </li>
        {/each}
      </ul>
    </div>
    <Dialog.Footer>
      <Button
        variant="outline"
        type="button"
        onclick={() => (open = false)}
        data-testid="delete-image-dialog-cancel">Zrušit</Button
      >
      <Button
        variant="destructive"
        type="button"
        onclick={onConfirm}
        disabled={isDeleting}
        data-testid="delete-image-dialog-confirm"
      >
        {isDeleting ? "Mazání..." : "Potvrdit smazání"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

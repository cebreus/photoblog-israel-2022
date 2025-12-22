<script lang="ts">
  import type { ImageEntry } from "$lib/types/manifest";

  let {
    open = $bindable(false),
    images,
    isArchiving = false,
    onConfirm,
  }: {
    open: boolean;
    images: ImageEntry[];
    isArchiving?: boolean;
    onConfirm: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content data-testid="archive-image-dialog-content">
    <Dialog.Header>
      <Dialog.Title>Archivovat fotky?</Dialog.Title>
      <Dialog.Description>
        Následující fotky budou přesunuty do složky 'archive' a nebudou se již zobrazovat na webu.
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
        data-testid="archive-image-dialog-cancel">Zrušit</Button
      >
      <Button
        variant="default"
        type="button"
        onclick={onConfirm}
        disabled={isArchiving}
        data-testid="archive-image-dialog-confirm"
      >
        {isArchiving ? "Archivace..." : "Potvrdit archivaci"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

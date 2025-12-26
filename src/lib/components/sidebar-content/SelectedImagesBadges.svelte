<script lang="ts">
  import X from "@lucide/svelte/icons/x";

  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import type { ImageEntry } from "$lib/types/manifest";

  let { images, hasClipboardData, onRemove, onClearAll, onPaste } = $props<{
    images: ImageEntry[];
    hasClipboardData: boolean;
    onRemove: (id: string) => void;
    onClearAll: () => void;
    onPaste: () => void;
  }>();
</script>

{#if images.length > 0}
  <div class="flex flex-wrap gap-1 p-4 pt-2 border-b" data-testid="edit-tab-selected-images">
    {#if images.length > 1}
      <Badge
        variant="destructive"
        class="font-mono text-xs cursor-pointer"
        onclick={onClearAll}
        data-testid="edit-tab-clear-selection"
      >
        Odebrat vše
      </Badge>
    {/if}

    {#if hasClipboardData}
      <Badge
        class="font-mono text-xs cursor-pointer"
        onclick={onPaste}
        aria-label="Vložit metadata na vybrané obrázky"
        data-testid="edit-tab-paste-metadata"
      >
        Vložit metadata
      </Badge>
    {/if}

    {#each images as img (img.id)}
      <Badge
        variant="secondary"
        class="font-mono text-xs flex gap-1 items-center pr-1"
        data-testid="edit-tab-selected-image-{img.id}"
      >
        {img.src.split("/").pop()}
        <Button
          variant="ghost"
          size="icon"
          class="size-4 rounded-full p-0 h-4 w-4 text-muted-foreground hover:text-foreground"
          onclick={() => onRemove(img.id)}
          aria-label="Odebrat z výběru"
        >
          <X size={10} />
        </Button>
      </Badge>
    {/each}
  </div>
{/if}

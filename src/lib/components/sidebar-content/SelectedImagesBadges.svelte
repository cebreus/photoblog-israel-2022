<script lang="ts">
  import Layers from "@lucide/svelte/icons/layers";
  import X from "@lucide/svelte/icons/x";

  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as m from "$lib/paraglide/messages";
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
  <div class="flex flex-wrap gap-1 border-b p-4 pt-2" data-testid="edit-tab-selected-images">
    {#if images.length > 1}
      <Badge
        variant="destructive"
        class="cursor-pointer font-mono text-xs"
        onclick={onClearAll}
        data-testid="edit-tab-clear-selection"
      >
        {m.ui_remove_all()}
      </Badge>
    {/if}

    {#if hasClipboardData}
      <Badge
        class="cursor-pointer font-mono text-xs"
        onclick={onPaste}
        aria-label={m.aria_paste_metadata_selected()}
        data-testid="edit-tab-paste-metadata"
      >
        {m.ui_paste_metadata()}
      </Badge>
    {/if}

    {#each images as img (img.id)}
      <Badge
        variant="secondary"
        class="flex items-center gap-1 pr-1 font-mono text-xs"
        data-testid="edit-tab-selected-image-{img.id}"
      >
        {#if img.sequenceInfo}
          <Layers class="h-3 w-3 text-blue-500" />
        {/if}
        <span class="max-w-[150px] truncate" title={img.src.split("/").pop()}>
          {img.src.split("/").pop()}
        </span>
        {#if img.sequenceInfo}
          <span class="text-muted-foreground ml-0.5 text-[10px]">
            {m.ui_group_count({ count: img.sequenceInfo.total })}
          </span>
        {/if}
        <Button
          variant="ghost"
          size="icon"
          class="text-muted-foreground hover:text-foreground size-4 rounded-full p-0"
          onclick={() => onRemove(img.id)}
          aria-label={m.aria_remove_from_selection()}
        >
          <X size={10} />
        </Button>
      </Badge>
    {/each}
  </div>
{/if}

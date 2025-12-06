<script lang="ts">
  import { RectangleVertical, Square, Cylinder } from "@lucide/svelte";

  let { aspectRatio } = $props<{
    aspectRatio: string;
  }>();

  const isSquare = $derived(aspectRatio === "square");
  const isPortrait = $derived(aspectRatio.startsWith("portrait"));
  const isPanorama = $derived(aspectRatio === "panorama");
</script>

<div
  class="absolute top-2 right-2 bg-gray-900 bg-opacity-50 p-1.5 rounded-md text-white pointer-events-none"
>
  {#if isSquare}
    <Square class="w-4 h-4" />
  {:else if isPortrait}
    <RectangleVertical class="w-4 h-4" />
  {:else if isPanorama}
    <Cylinder class="w-4 h-4" />
  {/if}
</div>

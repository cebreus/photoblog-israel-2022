<script lang="ts">
  import Circle from "@lucide/svelte/icons/circle";
  import Cylinder from "@lucide/svelte/icons/cylinder";
  import RectangleVertical from "@lucide/svelte/icons/rectangle-vertical";
  import Square from "@lucide/svelte/icons/square";

  let { aspectRatio } = $props<{
    aspectRatio?: string;
  }>();

  let _IconComponent = $state<
    typeof Square | typeof RectangleVertical | typeof Cylinder | typeof Circle | undefined
  >(undefined);

  $effect(() => {
    if (aspectRatio === "square") {
      _IconComponent = Square;
    } else if (aspectRatio?.startsWith("portrait")) {
      _IconComponent = RectangleVertical;
    } else if (aspectRatio === "panorama") {
      _IconComponent = Cylinder;
    } else if (aspectRatio === "sphere") {
      _IconComponent = Circle;
    } else {
      _IconComponent = undefined; // Or a default icon if desired
    }
  });
</script>

<div
  class="absolute top-2 right-2 bg-gray-900 bg-opacity-50 p-1.5 rounded-md text-white pointer-events-none"
  data-testid="aspect-ratio-icon"
>
  {#if IconComponent}
    <IconComponent class="w-4 h-4" />
  {/if}
</div>

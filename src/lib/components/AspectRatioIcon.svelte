<script lang="ts">
  import Circle from "@lucide/svelte/icons/circle";
  import Cylinder from "@lucide/svelte/icons/cylinder";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import RectangleVertical from "@lucide/svelte/icons/rectangle-vertical";
  import Square from "@lucide/svelte/icons/square";

  let { aspectRatio, isCollage } = $props<{
    aspectRatio?: string;
    isCollage?: boolean;
  }>();

  let IconComponent = $state<
    | typeof Square
    | typeof RectangleVertical
    | typeof Cylinder
    | typeof Circle
    | typeof LayoutGrid
    | undefined
  >(undefined);

  $effect(() => {
    if (isCollage) {
      IconComponent = LayoutGrid;
    } else if (aspectRatio === "square") {
      IconComponent = Square;
    } else if (aspectRatio?.startsWith("portrait")) {
      IconComponent = RectangleVertical;
    } else if (aspectRatio === "panorama") {
      IconComponent = Cylinder;
    } else if (aspectRatio === "sphere") {
      IconComponent = Circle;
    } else {
      IconComponent = undefined; // Or a default icon if desired
    }
  });
</script>

<div
  class="bg-opacity-50 pointer-events-none absolute top-2 right-2 rounded-md bg-gray-900 p-1.5 text-white"
  data-testid="aspect-ratio-icon"
>
  {#if IconComponent}
    <IconComponent class="h-4 w-4" />
  {/if}
</div>

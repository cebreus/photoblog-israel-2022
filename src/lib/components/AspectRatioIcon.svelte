<script lang="ts">
import { RectangleVertical, Square, Cylinder, Circle } from "@lucide/svelte";

let { aspectRatio } = $props<{
  aspectRatio?: string;
}>();

let IconComponent = $state<
  typeof Square | typeof RectangleVertical | typeof Cylinder | typeof Circle | undefined
>(undefined);

$effect(() => {
  if (aspectRatio === "square") {
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
  class="absolute top-2 right-2 bg-gray-900 bg-opacity-50 p-1.5 rounded-md text-white pointer-events-none"
  data-testid="aspect-ratio-icon"
>
  {#if IconComponent}
    <IconComponent class="w-4 h-4" />
  {/if}
</div>

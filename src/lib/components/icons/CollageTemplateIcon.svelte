<script lang="ts">
  import type { CollageTemplateId } from "$lib/types/collage";

  export let template: CollageTemplateId;
  export let className: string = "";
</script>

<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
>
  {#if template === "row"}
    <!-- [ ][ ] -->
    <rect x="2" y="4" width="9" height="16" rx="1" />
    <rect x="13" y="4" width="9" height="16" rx="1" />
  {:else if template === "column"}
    <!-- [ ]
         [ ] -->
    <rect x="4" y="2" width="16" height="9" rx="1" />
    <rect x="4" y="13" width="16" height="9" rx="1" />
  {:else if template === "grid-2x2"}
    <!-- [ ][ ]
         [ ][ ] -->
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="8" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" />
    <rect x="13" y="13" width="8" height="8" rx="1" />
  {:else if template === "hero-top"}
    <!-- [      ]
         [ ][ ] -->
    <rect x="3" y="3" width="18" height="10" rx="1" />
    <rect x="3" y="15" width="8" height="6" rx="1" />
    <rect x="13" y="15" width="8" height="6" rx="1" />
  {:else if template === "hero-left"}
    <!-- [ |-] -->
    <rect x="3" y="3" width="10" height="18" rx="1" />
    <rect x="15" y="3" width="6" height="8" rx="1" />
    <rect x="15" y="13" width="6" height="8" rx="1" />
  {:else if template === "hero-right"}
    <!-- [-| ] -->
    <rect x="3" y="3" width="6" height="8" rx="1" />
    <rect x="3" y="13" width="6" height="8" rx="1" />
    <rect x="11" y="3" width="10" height="18" rx="1" />
  {:else if template === "grid-2-3"}
    <!-- R1 (2), R2 (3) -->
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="8" rx="1" />
    <rect x="3" y="13" width="5.5" height="8" rx="1" />
    <rect x="9.5" y="13" width="5" height="8" rx="1" />
    <rect x="15.5" y="13" width="5.5" height="8" rx="1" />
  {:else if template === "grid-3-2"}
    <!-- R1 (3), R2 (2) -->
    <rect x="3" y="3" width="5.5" height="8" rx="1" />
    <rect x="9.5" y="3" width="5" height="8" rx="1" />
    <rect x="15.5" y="3" width="5.5" height="8" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" />
    <rect x="13" y="13" width="8" height="8" rx="1" />
  {:else if template === "sidebar-grid"}
    <!-- Hero Left (1), Grid Right (2x2) -->
    <rect x="2" y="3" width="10" height="18" rx="1" />
    <rect x="13.5" y="3" width="4" height="8" rx="1" />
    <rect x="18.5" y="3" width="4" height="8" rx="1" />
    <rect x="13.5" y="13" width="4" height="8" rx="1" />
    <rect x="18.5" y="13" width="4" height="8" rx="1" />
  {:else if template === "sidebar-hero"}
    <!-- Left Hero, Right: [2][3] (top), [4] (bottom) -->
    <rect x="3" y="3" width="8" height="18" rx="1" />
    <rect x="13" y="3" width="3.5" height="8" rx="1" />
    <rect x="17.5" y="3" width="3.5" height="8" rx="1" />
    <rect x="13" y="13" width="8" height="8" rx="1" />
  {:else if template === "grid-3x2"}
    <!-- 3 rows of 2 -->
    <rect x="3" y="2" width="8" height="5" rx="1" />
    <rect x="13" y="2" width="8" height="5" rx="1" />

    <rect x="3" y="9" width="8" height="5" rx="1" />
    <rect x="13" y="9" width="8" height="5" rx="1" />

    <rect x="3" y="16" width="8" height="5" rx="1" />
    <rect x="13" y="16" width="8" height="5" rx="1" />
  {:else if template === "mosaic-6"}
    <!-- 3 cols: 2 items, 3 items, 1 item(actually 2-3-1 logic from engine) -->
    <!-- Col 1 -->
    <rect x="2" y="2" width="6" height="9" rx="1" />
    <rect x="2" y="13" width="6" height="9" rx="1" />
    <!-- Col 2 -->
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <rect x="9" y="16" width="6" height="6" rx="1" />
    <!-- Col 3 -->
    <rect x="16" y="2" width="6" height="20" rx="1" />
  {:else if template === "density-7"}
    <!-- 2 - 3 - 2 -->
    <!-- R1 -->
    <rect x="3" y="2" width="8" height="5" rx="1" />
    <rect x="13" y="2" width="8" height="5" rx="1" />
    <!-- R2 -->
    <rect x="3" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="6" height="5" rx="1" />
    <rect x="16" y="9" width="5" height="5" rx="1" />
    <!-- R3 -->
    <rect x="3" y="16" width="8" height="5" rx="1" />
    <rect x="13" y="16" width="8" height="5" rx="1" />
  {/if}
</svg>

<script lang="ts">
import { getContext } from "svelte";
import { OFFCANVAS_CONTEXT_KEY, type OffcanvasContext } from "./offcanvas-context";
import type { Snippet } from "svelte";
import { cn } from "$lib/utils";

let {
  children,
  class: className,
  ...restProps
}: {
  children: Snippet;
  class?: string;
  // allow arbitrary passthrough attributes (data-testid etc.)
  [key: string]: any;
} = $props();

const { toggleOpen } = getContext<OffcanvasContext>(OFFCANVAS_CONTEXT_KEY);
</script>

<button class={cn(className)} onclick={toggleOpen} {...restProps}>
  {@render children?.()}
</button>

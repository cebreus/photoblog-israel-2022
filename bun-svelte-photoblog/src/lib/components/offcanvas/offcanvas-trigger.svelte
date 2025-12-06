<script lang="ts">
  import { getContext } from "svelte";
  import {
    OFFCANVAS_CONTEXT_KEY,
    type OffcanvasContext,
  } from "./offcanvas-context";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  let {
    children,
    class: className,
    ...restProps
  }: {
    children: Snippet;
    class?: string;
  } = $props();

  const { toggleOpen } = getContext<OffcanvasContext>(OFFCANVAS_CONTEXT_KEY);
</script>

<button class={cn(className)} onclick={toggleOpen} {...restProps}>
  {@render children?.()}
</button>

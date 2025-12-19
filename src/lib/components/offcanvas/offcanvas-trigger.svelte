<script lang="ts">
  import { cn } from "$lib/utils";
  import { OFFCANVAS_CONTEXT_KEY, type OffcanvasContext } from "./offcanvas-context";
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";

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

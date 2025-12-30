<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import Button from "$lib/components/ui/button/button.svelte";
  import { cn } from "$lib/utils";

  import { OFFCANVAS_CONTEXT_KEY, type OffcanvasContext } from "./offcanvas-context";

  let {
    children,
    className = "",
    side = "right",
    ...restProps
  }: {
    children: Snippet;
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
  } & HTMLAttributes<HTMLDivElement> = $props();

  const { openStore, toggleOpen } = getContext<OffcanvasContext>(OFFCANVAS_CONTEXT_KEY); // Get toggleOpen from context

  let open = $state(false); // Make open reactive
  openStore.subscribe((value) => {
    open = value;
  });
</script>

{#if open}
  <div
    class={cn(
      "bg-background fixed z-50 h-full w-96 shadow-lg",
      "transition-transform duration-300 ease-in-out",
      side === "left" && "top-0 left-0",
      side === "right" && "top-0 right-0",
      side === "top" && "top-0 left-0 h-1/2 w-full",
      side === "bottom" && "bottom-0 left-0 h-1/2 w-full",
      open
        ? side === "right"
          ? "translate-x-0"
          : side === "left"
            ? "translate-x-0"
            : side === "top"
              ? "translate-y-0"
              : "translate-y-0"
        : side === "right"
          ? "translate-x-full"
          : side === "left"
            ? "-translate-x-full"
            : side === "top"
              ? "-translate-y-full"
              : "translate-y-full",
      className,
    )}
    {...restProps}
  >
    <Button variant="ghost" size="sm" class="absolute end-5 top-4 " onclick={toggleOpen}>
      <X />
      <span class="sr-only">Close</span>
    </Button>
    {@render children?.()}
  </div>
{/if}

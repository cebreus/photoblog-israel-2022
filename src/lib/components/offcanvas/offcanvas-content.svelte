<script lang="ts">
  import { getContext } from "svelte";
  import { OFFCANVAS_CONTEXT_KEY, type OffcanvasContext } from "./offcanvas-context";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";
  import { X } from "lucide-svelte";
  import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte"; // Import Button and buttonVariants

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
  openStore.subscribe((value) => (open = value));
</script>

{#if open}
  <div
    class={cn(
      "fixed z-50 h-full w-96 shadow-lg bg-background",
      "transition-transform duration-300 ease-in-out",
      side === "left" && "left-0 top-0",
      side === "right" && "right-0 top-0",
      side === "top" && "left-0 top-0 w-full h-1/2",
      side === "bottom" && "left-0 bottom-0 w-full h-1/2",
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

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  import Badge from "$lib/components/ui/badge/badge.svelte";
  import { type WithElementRef, cn } from "$lib/utils";

  let {
    ref = $bindable(null),
    children,
    child,
    class: className,
    size = "md",
    isHashActive = false,
    isScrollspyActive = false,
    isDimmed = false,
    firstPhotoExifDate,
    startDate,
    endDate,
    ...restProps
  }: WithElementRef<HTMLAnchorAttributes> & {
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    size?: "sm" | "md";
    isHashActive?: boolean;
    isScrollspyActive?: boolean;
    isDimmed?: boolean;
    firstPhotoExifDate?: string;
    startDate?: string;
    endDate?: string;
  } = $props();

  const formattedTime = $derived(
    startDate || firstPhotoExifDate || endDate
      ? (startDate || firstPhotoExifDate || (endDate as string)).includes("T")
        ? (startDate || firstPhotoExifDate || (endDate as string)).split("T")[1].substring(0, 5)
        : undefined
      : undefined,
  );

  const mergedProps = $derived({
    class: cn(
      "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground outline-hidden flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 focus-visible:ring-2",
      "data-[dimmed=true]:text-sidebar-foreground/50 data-[dimmed=true]:cursor-default",
      size === "sm" && "text-xs",
      size === "md" && "text-sm",
      "group-data-[collapsible=icon]:hidden",
      className,
      // isScrollspyActive &&
      //   "bg-orange-100 text-orange-700 dark:text-orange-100 dark:bg-orange-900/50",
      isHashActive && !isScrollspyActive && "bg-sidebar-accent text-sidebar-accent-foreground",
    ),
    "data-slot": "sidebar-menu-sub-button",
    "data-sidebar": "menu-sub-button",
    "data-size": size,
    "data-active": isHashActive,
    "data-scrollspy-active": isScrollspyActive,
    "data-dimmed": isDimmed,
    ...restProps,
  });
</script>

{#if child}
  {@render child({ props: mergedProps })}
{:else}
  <a bind:this={ref} {...mergedProps}>
    {#if formattedTime}
      <Badge
        variant="outline"
        class={cn(
          "text-sidebar-foreground/50 tabular-nums",
          isScrollspyActive && "border-orange-300/50 text-orange-300",
        )}
      >
        {formattedTime}
      </Badge>
    {/if}
    {@render children?.()}
  </a>
{/if}

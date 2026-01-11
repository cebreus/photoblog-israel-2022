<script lang="ts">
  import { fade } from "svelte/transition";

  import { Spinner } from "$lib/components/ui/spinner";
  import { cn } from "$lib/utils";

  export let visible: boolean = false;
  export let label: string = "";
  export let description: string = "";
  export let spinnerClass: string = "h-8 w-8";
  // Allow overriding classes for the container
  let className: string = "";
  export { className as class };
</script>

{#if visible}
  <div
    class={cn(
      "bg-background/80 absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm",
      className,
    )}
    transition:fade={{ duration: 200 }}
    data-testid="loading-overlay"
  >
    <Spinner class={spinnerClass} />
    {#if label}
      <div class="mt-4 flex flex-col items-center gap-1 text-center">
        <p class="font-medium">{label}</p>
        {#if description}
          <p class="text-muted-foreground text-sm">{description}</p>
        {/if}
      </div>
    {/if}
    <slot />
  </div>
{/if}

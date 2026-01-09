<script lang="ts">
  import User from "@lucide/svelte/icons/user";
  import type { Snippet } from "svelte";

  import { Button } from "$lib/components/ui/button";
  import type { Person } from "$lib/types/manifest";
  import { cn } from "$lib/utils";

  let {
    person,
    selected = false,
    getThumbnailSrc,
    onToggle,
    onOpenDetail,
    testId,
    showCount = true,
    mergeButtonTestId,
    footer,
  }: {
    person: Person;
    selected?: boolean;
    getThumbnailSrc: (p: Person) => string;
    onToggle: (id: string, e?: MouseEvent | KeyboardEvent) => void;
    onOpenDetail?: (p: Person) => void;
    testId: string;
    showCount?: boolean;
    mergeButtonTestId?: string;
    footer?: Snippet<[Person]>;
  } = $props();
</script>

<div
  class="bg-card text-card-foreground flex flex-col overflow-hidden rounded-md border shadow-sm"
  data-testid={testId}
>
  <div
    class="group relative aspect-square cursor-pointer overflow-hidden bg-slate-100 dark:bg-slate-900"
    role="button"
    tabindex="0"
    onclick={(e) => onToggle(person.id, e)}
    aria-label={person.name}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(person.id, e);
      }
    }}
  >
    {#if person.hidden}
      <span
        class="absolute top-1 left-1 z-10 rounded bg-amber-500 px-1 py-0.5 text-[10px] text-white shadow"
      >
        Skrytá
      </span>
    {/if}

    {#if person.thumbnail}
      <img
        src={getThumbnailSrc(person)}
        alt={person.name}
        class="h-full w-full object-cover transition-all duration-300"
      />
    {:else}
      <div class="flex h-full w-full items-center justify-center">
        <User class="h-4 w-4 text-slate-400" />
      </div>
    {/if}

    <div class="absolute top-1 right-1 z-10">
      <div
        class={cn(
          "flex h-5 w-5 items-center justify-center rounded border border-white shadow-sm transition-colors",
          selected ? "bg-primary border-primary" : "bg-black/40 group-hover:bg-black/60",
        )}
        data-testid={mergeButtonTestId ?? `${testId}-merge-button`}
      >
        {#if selected}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-white"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        {/if}
      </div>
    </div>
  </div>

  <div class="bg-muted/20 flex flex-col gap-1 p-1">
    <Button
      variant="ghost"
      class="text-muted-foreground h-auto w-full cursor-pointer truncate border-none bg-transparent p-0 px-1 text-center text-[10px] font-medium hover:underline"
      title={person.name}
      onclick={() => onOpenDetail?.(person)}
    >
      {person.name}
    </Button>
    {#if showCount}
      <div class="text-muted-foreground text-center text-[10px]">{person.faceCount} fotek</div>
    {/if}
    {@render footer?.(person)}
  </div>
</div>

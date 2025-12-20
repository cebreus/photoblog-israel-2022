<script lang="ts">
  import type { Person } from "$lib/types/manifest";
  import { cn } from "$lib/utils";
  import User from "lucide-svelte/icons/user";
  import type { Snippet } from "svelte";

  let {
    person,
    selected = false,
    getThumbnailSrc,
    onToggle,
    testId,
    showCount = true,
    mergeButtonTestId,
    footer,
  }: {
    person: Person;
    selected?: boolean;
    getThumbnailSrc: (p: Person) => string;
    onToggle: (id: string) => void;
    testId: string;
    showCount?: boolean;
    mergeButtonTestId?: string;
    footer?: Snippet<[Person]>;
  } = $props();
</script>

<div
  class="flex flex-col rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden"
  data-testid={testId}
>
  <div
    class="aspect-square relative group overflow-hidden bg-slate-100 dark:bg-slate-900 cursor-pointer"
    role="button"
    tabindex="0"
    onclick={() => onToggle(person.id)}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(person.id);
      }
    }}
  >
    {#if person.ignored}
      <span
        class="absolute top-1 left-1 z-10 rounded bg-amber-500 text-[10px] px-1 py-0.5 text-white shadow"
      >
        Skrytá
      </span>
    {/if}

    {#if person.thumbnail}
      <img
        src={getThumbnailSrc(person)}
        alt={person.name}
        class="w-full h-full object-cover transition-all duration-300"
      />
    {:else}
      <div class="flex items-center justify-center w-full h-full">
        <User class="w-4 h-4 text-slate-400" />
      </div>
    {/if}

    <div class="absolute top-1 right-1 z-10">
      <div
        class={cn(
          "h-5 w-5 rounded border border-white flex items-center justify-center transition-colors shadow-sm",
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

  <div class="p-1 flex flex-col gap-1 bg-muted/20">
    <span
      class="text-[10px] text-muted-foreground w-full truncate text-center font-medium px-1"
      title={person.name}
    >
      {person.name}
    </span>
    {#if showCount}
      <div class="text-[10px] text-muted-foreground text-center">{person.faceCount} fotek</div>
    {/if}
    {@render footer?.(person)}
  </div>
</div>

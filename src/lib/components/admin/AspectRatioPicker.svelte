<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import { cn } from "$lib/utils";

  let {
    value = $bindable(),
    onSelect,
    includeOriginal = false,
    includeFree = false,
    includeAuto = false,
    layout = "grid",
    class: className,
  } = $props<{
    value: string;
    onSelect?: (r: string) => void;
    includeOriginal?: boolean;
    includeFree?: boolean;
    includeAuto?: boolean;
    layout?: "grid" | "group";
    class?: string;
  }>();

  const groups = $derived.by(() => {
    const list = [];

    // Specials
    const specials = [];
    if (includeAuto) specials.push({ id: "auto", label: "Auto" });
    if (includeOriginal) specials.push({ id: "original", label: "Původní" });
    if (includeFree) specials.push({ id: "free", label: "Volný" });
    if (specials.length > 0) list.push({ id: "special", items: specials });

    // Landscape
    list.push({
      id: "landscape",
      label: "Landscape",
      items: [
        { id: "3:2", label: "3:2" },
        { id: "4:3", label: "4:3" },
        { id: "16:9", label: "16:9" },
        { id: "21:9", label: "21:9" },
        { id: "5:4", label: "5:4" },
      ],
    });

    // Portrait / Square
    list.push({
      id: "portrait",
      label: "Portrait / Square",
      items: [
        { id: "1:1", label: "1:1" },
        { id: "2:3", label: "2:3" },
        { id: "3:4", label: "3:4" },
        { id: "4:5", label: "4:5" },
      ],
    });

    return list;
  });

  function handleSelect(id: string) {
    value = id;
    onSelect?.(id);
  }
</script>

{#if layout === "group"}
  <div class={cn("flex flex-wrap gap-2", className)}>
    {#each groups as group}
      <ButtonGroup.Root>
        {#each group.items as r}
          <Button
            variant={value === r.id ? "secondary" : "outline"}
            size="sm"
            onclick={() => handleSelect(r.id)}
            data-testid={`ratio-${r.id.replace(":", "-")}`}
          >
            {r.label}
          </Button>
        {/each}
      </ButtonGroup.Root>
    {/each}
  </div>
{:else}
  <div class={cn("flex flex-col gap-4", className)}>
    {#each groups as group}
      <div class="flex flex-col gap-1.5">
        {#if group.label}
          <span
            class="text-muted-foreground/70 px-1.5 text-[10px] font-bold tracking-wider uppercase"
          >
            {group.label}
          </span>
        {/if}
        <div class="grid grid-cols-2 gap-2">
          {#each group.items as r}
            <Button
              variant={value === r.id ? "secondary" : "outline"}
              size="sm"
              onclick={() => handleSelect(r.id)}
              class="h-8 w-full text-xs"
              data-testid={`ratio-${r.id.replace(":", "-")}`}
            >
              {r.label}
            </Button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

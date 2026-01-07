<script lang="ts">
  import { formatWallClock } from "$shared/utils/dates";
  import { toast } from "svelte-sonner";

  import { useScrollspy } from "$lib/actions/scrollspy";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { editor } from "$lib/stores/editor.svelte";
  import { filters } from "$lib/stores/filters.svelte";
  import type { Separator } from "$lib/types/manifest";
  import { cn } from "$lib/utils";
  import { tracedFetch } from "$lib/utils/api";

  import { browser } from "$app/environment";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";

  let {
    item,
    showMetadataOverlay = false,
    dayId,
  } = $props<{
    item: Separator;
    showMetadataOverlay?: boolean;
    dayId?: string;
  }>();

  // Combine store state with URL param to prevent layout shift during SSR/hydration
  let showMetadata = $derived(
    showMetadataOverlay ||
      editor.showMetadataOverlay ||
      (browser &&
        page.url.searchParams.has("overlay") &&
        page.url.searchParams.get("overlay") !== "false"),
  );

  let separatorId = $derived(item.id);

  async function handleRedistribute(e: MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Opravdu chcete rovnoměrně přerozdělit fotky v lokalitě "${item.location}"?`)) {
      return;
    }

    try {
      const res = await tracedFetch("/api/images/redistribute", {
        method: "POST",
        body: JSON.stringify({ dayId, location: item.location }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Přerozděleno ${result.redistributed} fotek`, { duration: 4000 });
        invalidateAll();
      } else {
        toast.error(result.error || "Chyba při přerozdělování");
      }
    } catch (err) {
      toast.error("Chyba při komunikaci se serverem");
    }
  }

  async function handleResetLocation(e: MouseEvent) {
    e.stopPropagation();
    if (
      !confirm(`Opravdu chcete vrátit fotky v lokalitě "${item.location}" do původního pořadí?`)
    ) {
      return;
    }

    try {
      const res = await tracedFetch("/api/images/reorder", {
        method: "DELETE",
        body: JSON.stringify({ dayId, location: item.location }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Lokace resetována");
        invalidateAll();
      } else {
        toast.error("Chyba při resetování");
      }
    } catch (err) {
      toast.error("Chyba při komunikaci se serverem");
    }
  }
</script>

{#snippet ActionButtons()}
  {#if editor.reorderMode && dayId}
    <div class="mt-4 flex flex-wrap justify-center gap-2">
      <button
        class={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "bg-background/50 backdrop-blur-sm",
        )}
        onclick={handleRedistribute}
      >
        Rovnoměrně rozprostřít
      </button>

      <button
        class={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "text-muted-foreground hover:text-destructive",
        )}
        onclick={handleResetLocation}
      >
        Resetovat lokaci
      </button>
    </div>
  {/if}
{/snippet}

{#snippet SeparatorMetadata()}
  {@const metadataRows = [
    { label: "ID", value: item.id, isTechnical: true },
    { label: "Start", value: item.startDate ? formatWallClock(item.startDate) : undefined },
    { label: "End", value: item.endDate ? formatWallClock(item.endDate) : undefined },
    { label: "Location", value: item.location },
    { label: "City", value: item.city },
    { label: "Title", value: item.storyTitle },
  ]}

  {#if showMetadata}
    <div data-testid="photo-grid-separator-metadata-container">
      <table
        class="mt-2 w-full rounded-md bg-slate-50 text-xs dark:bg-slate-950"
        data-testid="photo-grid-separator-metadata-table"
      >
        <tbody>
          {#each metadataRows as field, index}
            <tr
              class={index < metadataRows.length - 1
                ? "border-b border-slate-400 dark:border-slate-700"
                : ""}
              data-testid="photo-grid-separator-metadata-row-{field.label
                .toLowerCase()
                .replace(/\s+/g, '-')}"
            >
              <th
                class="text-muted-foreground min-w-16 px-1 py-1 text-left align-baseline font-medium"
              >
                {field.label}
              </th>
              <td
                class={cn(
                  "w-full max-w-full min-w-0 py-1 text-left font-mono",
                  field.label === "ID" ? "break-all" : "line-clamp-3 whitespace-pre-line",
                  field.isTechnical && "text-muted-foreground",
                )}
              >
                {#if field.value}
                  {@html field.value}
                {:else}
                  <span class="text-muted-foreground"></span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/snippet}

{#if item.hasPhotos}
  <div
    id={separatorId}
    use:useScrollspy={{ id: separatorId }}
    class={cn(
      !filters.showSeparators && "h-0 overflow-hidden",
      filters.showSeparators && "flex flex-col",
      filters.showSeparators && (editor.editMode ? "col-span-full py-12" : "aspect-[3/2]"),
    )}
  >
    {#if !filters.showSeparators}
      <!-- Hidden anchor for navigation and A11Y -->
      <h3 class="sr-only">{item.location}</h3>
      {#if item.city}
        <p class="sr-only">{item.city}</p>
      {/if}
    {:else if item.story}
      <!-- Separator with story (dialog) -->

      <div>
        <Dialog.Root>
          <Dialog.Trigger
            class={cn(
              "flex  w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-slate-100 to-slate-300 p-4 text-center dark:from-slate-700 dark:to-slate-800",
              editor.editMode ? "dark:from-pink-700 dark:to-pink-800" : "aspect-[3/2]",
            )}
            data-testid="photo-grid-separator-trigger-{separatorId}"
          >
            <h3 class="text-lg" data-testid="photo-grid-separator-location">
              {item.location}
            </h3>
            {#if item.city}
              <p class="text-muted-foreground text-sm" data-testid="photo-grid-separator-city">
                {item.city}
              </p>
            {/if}
            <span
              class={buttonVariants({
                size: "sm",
                variant: "link",
                class: "mt-2 text-sm",
              })}
              data-testid="photo-grid-separator-show-story"
            >
              Zobrazit příběh
            </span>
            {@render ActionButtons()}
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{item.storyTitle || item.location}</Dialog.Title>
              {#if item.city}
                <Dialog.Description>{item.city}</Dialog.Description>
              {/if}
            </Dialog.Header>
            <div
              class="prose prose-sm dark:prose-invert mt-4 max-h-[80vh] max-w-none overflow-hidden pr-4"
              data-testid="photo-grid-separator-story-{separatorId}"
            >
              {@html item.story}
            </div>
          </Dialog.Content>
        </Dialog.Root>

        {@render SeparatorMetadata()}
      </div>
    {:else}
      <!-- Simple separator (no story) -->

      <div
        class={cn(
          "flex w-full flex-col  items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-slate-100 to-slate-300 p-4 text-center dark:from-slate-700 dark:to-slate-800",
          editor.editMode ? "dark:from-pink-700 dark:to-pink-800" : "aspect-[3/2]",
        )}
        data-testid="photo-grid-separator-simple-{separatorId}"
      >
        <h3 class="text-lg" data-testid="photo-grid-separator-location">
          {item.location}
        </h3>
        {#if item.city}
          <p class="text-muted-foreground mt-1 text-sm">{item.city}</p>
        {/if}
        {@render ActionButtons()}
      </div>
      {@render SeparatorMetadata()}
    {/if}
  </div>
{/if}

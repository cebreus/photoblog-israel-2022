<script lang="ts">
  import CheckSquare from "lucide-svelte/icons/check-square";
  import Square from "lucide-svelte/icons/square";

  import { useFancybox } from "$lib/actions/fancybox";
  import { useScrollspy } from "$lib/actions/scrollspy";
  import Hero from "$lib/components/Hero.svelte";
  import PhotoGrid from "$lib/components/PhotoGrid.svelte";
  import { Badge } from "$lib/components/ui/badge/";
  import { Button } from "$lib/components/ui/button";
  import { editor } from "$lib/stores/editor.svelte";
  import { filters } from "$lib/stores/filters.svelte";
  import type { ImageEntry, PhotoDay, Separator } from "$lib/types/manifest";
  import { filterGalleryItems, mergeSparseDays } from "$lib/utils/gallery";
  import { formatDateForDisplay, formatDateRange, formatWeekdayCzech } from "$lib/utils/strings";

  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  /**
   * Compute page-specific filtered days.
   * Preserves page metadata like cities/locations.
   */
  let filteredDays = $derived(
    (data.photoDays || [])
      .map((day: PhotoDay) => ({
        ...day,
        items: filterGalleryItems(
          day.items,
          filters.selectedAuthors,
          filters.showSeparators,
          filters.selectedQualityBuckets,
          filters.selectedPeople,
        ),
      }))
      .filter((d: PhotoDay) => d.items && d.items.length > 0),
  );

  /**
   * Merges days with very few photos (<=2) into combined sections
   * to avoid massive headers for tiny content.
   */
  let photoDays = $derived(mergeSparseDays(filteredDays));
</script>

<Hero />

<!-- visible count moved to FiltersOffcanvas header -->

{#if filters.selectedAuthors.length > 0 && photoDays.length === 0}
  <div class="container mx-auto py-12 text-center text-sm text-muted-foreground">
    <p>Žádné fotky od vybraných autorů.</p>
  </div>
{/if}

{#each photoDays as day (day.id ?? `day-${day.date}`)}
  {@const daySectionId = day.id ?? `day-${day.date}`}
  {#if day.items.length > 0}
    <section
      id={daySectionId}
      class="container mx-auto py-8 px-6"
      use:useScrollspy={{ id: daySectionId }}
      use:useFancybox
    >
      <div data-cy="day-head" class="max-w-xl mx-auto text-center my-12 relative group">
        <h2 class="mb-1 text-3xl leading-snug">
          {#if day.mergedDates}
            <span
              class="block mb-1 text-xs font-normal tracking-[0.05em] uppercase before:content-['———'] before:tracking-[-0.3em] before:opacity-[0.34] before:mr-4 after:content-['———'] after:tracking-[-0.3em] after:opacity-[0.34] after:ml-3"
            >
              {#if day.mergedDates.length === 2}
                {formatWeekdayCzech(day.mergedDates[0])} a {formatWeekdayCzech(day.mergedDates[1])}
              {:else}
                {formatWeekdayCzech(day.mergedDates[0])}—{formatWeekdayCzech(
                  day.mergedDates[day.mergedDates.length - 1],
                )}
              {/if}
            </span>
            {formatDateRange(day.mergedDates)}
          {:else}
            <span
              class="block mb-1 text-xs font-normal tracking-[0.05em] uppercase before:content-['———'] before:tracking-[-0.3em] before:opacity-[0.34] before:mr-4 after:content-['———'] after:tracking-[-0.3em] after:opacity-[0.34] after:ml-3"
            >
              {formatWeekdayCzech(day.date)}
            </span>
            {formatDateForDisplay(day.date)}
          {/if}
        </h2>

        {#if day.cities && day.cities.length > 0}
          <div data-cy="day-cities" class="mb-6 text-lg">
            {day.cities.join(" — ")}
          </div>
        {/if}

        {#if day.locations && day.locations.length > 0}
          <div data-cy="day-where" class="mx-auto mb-5 gap-2 flex flex-wrap justify-center">
            {#each day.locations as locationName (locationName)}
              <Badge variant="secondary">{locationName}</Badge>
            {/each}
          </div>
        {/if}

        {#if editor.editMode}
          {@const dayImageIds = day.items
            .filter((i: ImageEntry | Separator) => i.type === "image")
            .map((i: ImageEntry | Separator) => i.id)}
          {@const allSelected =
            dayImageIds.length > 0 && dayImageIds.every((id: string) => editor.selection.has(id))}
          <div class="flex justify-center gap-2 mt-4 opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="sm"
              class="gap-2"
              onclick={() => {
                if (allSelected) {
                  editor.removeMultiple(dayImageIds);
                } else {
                  editor.addMultiple(dayImageIds);
                }
              }}
            >
              {#if allSelected}
                <Square size={14} />
                {day.mergedDates ? "Zrušit výběr dnů" : "Zrušit výběr dne"}
              {:else}
                <CheckSquare size={14} />
                {day.mergedDates ? "Vybrat celé dny" : "Vybrat celý den"}
              {/if}
            </Button>
          </div>
        {/if}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <PhotoGrid items={day.items} curationManifest={data.curationManifest} />
      </div>
    </section>
  {/if}
{/each}

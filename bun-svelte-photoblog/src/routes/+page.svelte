<script lang="ts">
  import PhotoGrid from "$lib/components/PhotoGrid.svelte";
  import { Badge } from "$lib/components/ui/badge/";
  import Hero from "$lib/components/Hero.svelte";
  import type { PageData } from "./$types";
  import { useScrollspy } from "$lib/actions/scrollspy"; // Import the useScrollspy action
  import { useFancybox } from "$lib/actions/fancybox";
  import { selectedAuthors, showSeparators } from "$lib/stores/filters";
  import type { ImageEntry, Separator, PhotoDay } from "$lib/types/manifest";
  import { filterGalleryItems } from "$lib/filter-utils";

  let { data } = $props<{ data: PageData }>();
  type PhotoDayWithMeta = PhotoDay & {
    cities?: string[];
    locations?: string[];
  };

  let photoDays = $derived<PhotoDayWithMeta[]>(data.photoDays || []);

  function formatDateForDisplay(dateValue: string | Date): string {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(new Date(dateValue));
  }

  function formatWeekdayCzech(dateValue: string | Date): string {
    return new Intl.DateTimeFormat("cs-CZ", { weekday: "long" }).format(
      new Date(dateValue),
    );
  }
</script>

<Hero />

<!-- visible count moved to FiltersOffcanvas header -->

{#if $selectedAuthors.length > 0 && !photoDays.some( (day) => day.items.some((item) => item.type === "image" && item.author && $selectedAuthors.includes(item.author)), )}
  <div
    class="container mx-auto py-12 text-center text-sm text-muted-foreground"
  >
    <p>Žádné fotky od vybraných autorů.</p>
  </div>
{/if}

<main>
  {#each photoDays as day (day.date)}
    {@const daySectionId = day.id ?? `day-${day.date}`}
    {@const filteredItems = filterGalleryItems(
      day.items,
      $selectedAuthors,
      $showSeparators,
    )}
    {#if filteredItems.length > 0}
      <section
        id={daySectionId}
        class="container mx-auto py-8"
        use:useScrollspy={{ id: daySectionId }}
        use:useFancybox
      >
        <div data-cy="day-head" class="max-w-xl mx-auto text-center my-12">
          <h2 class="mb-1 text-3xl">
            <span
              class="block mb-1 text-xs font-normal tracking-[0.05em] uppercase before:content-['———'] before:tracking-[-0.3em] before:opacity-[0.34] before:mr-4 after:content-['———'] after:tracking-[-0.3em] after:opacity-[0.34] after:ml-3"
            >
              {formatWeekdayCzech(day.date)}
            </span>
            {formatDateForDisplay(day.date)}
          </h2>

          {#if day.cities && day.cities.length > 0}
            <div data-cy="day-cities" class="mb-6 text-lg">
              {day.cities.join(" — ")}
            </div>
          {/if}

          {#if day.locations && day.locations.length > 0}
            <div
              data-cy="day-where"
              class="mx-auto mb-5 gap-2 flex flex-wrap justify-center"
            >
              {#each day.locations as locationName (locationName)}
                <Badge variant="secondary">{locationName}</Badge>
              {/each}
            </div>
          {/if}
        </div>

        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <PhotoGrid items={filteredItems} />
        </div>
      </section>
    {/if}
  {/each}
</main>

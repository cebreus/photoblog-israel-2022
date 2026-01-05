<script lang="ts">
  import {
    Award,
    Camera,
    CheckSquare,
    Database,
    Filter,
    Image as ImageIcon,
    RotateCcw,
    Square,
    SquarePlay,
    UserRound,
    Users,
  } from "@lucide/svelte";

  import { useFancybox } from "$lib/actions/fancybox";
  import { useScrollspy } from "$lib/actions/scrollspy";
  import GalleryEmptyState from "$lib/components/GalleryEmptyState.svelte";
  import Hero from "$lib/components/Hero.svelte";
  import PhotoGrid from "$lib/components/PhotoGrid.svelte";
  import { Badge } from "$lib/components/ui/badge/";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { editor } from "$lib/stores/editor.svelte";
  import { filters } from "$lib/stores/filters.svelte";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { mergeSparseDays } from "$lib/utils/gallery";
  import { EMPTY_MESSAGES } from "$lib/utils/messages";
  import { clearImageOrder } from "$lib/utils/reorder";
  import { formatDateForDisplay, formatDateRange, formatWeekdayCzech } from "$lib/utils/strings";
  import { smartToast } from "$lib/utils/toasts";

  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  /**
   * Compute page-specific filtered days.
   * Preserves page metadata like cities/locations.
   */
  let filteredDays = $derived(filters.filteredPhotoDays);

  /**
   * Merges days with very few photos (<=2) into combined sections
   * to avoid massive headers for tiny content.
   */
  let photoDays = $derived(mergeSparseDays(filteredDays));
  /**
   * Determine active empty state configuration
   */
  let activeEmptyState = $derived.by(() => {
    const activeFilters = {
      authors: filters.selectedAuthors.length > 0,
      people: filters.selectedPeople.length > 0,
      quality: filters.selectedQualityBuckets.length > 0,
      mediaTypes: filters.selectedMediaTypes.length > 0,
      onlySnapshots: filters.onlySnapshots,
    };
    const count = Object.values(activeFilters).filter(Boolean).length;

    if (count > 1) {
      return {
        title: EMPTY_MESSAGES.GENERIC_TITLE,
        description: EMPTY_MESSAGES.GENERIC_DESCRIPTION,
        icon: Filter,
        action: { label: EMPTY_MESSAGES.RESET_ALL, handler: () => filters.reset() },
      };
    }
    if (activeFilters.authors) {
      return {
        title: EMPTY_MESSAGES.AUTHORS_TITLE,
        description: EMPTY_MESSAGES.AUTHORS_DESCRIPTION,
        icon: UserRound,
        action: {
          label: EMPTY_MESSAGES.AUTHORS_RESET,
          handler: () => {
            filters.selectedAuthors = [];
          },
        },
      };
    }
    if (activeFilters.people) {
      return {
        title: EMPTY_MESSAGES.PEOPLE_TITLE,
        description: EMPTY_MESSAGES.PEOPLE_DESCRIPTION,
        icon: Users,
        action: {
          label: EMPTY_MESSAGES.PEOPLE_RESET,
          handler: () => {
            filters.selectedPeople = [];
          },
        },
      };
    }
    if (activeFilters.quality) {
      return {
        title: EMPTY_MESSAGES.QUALITY_TITLE,
        description: EMPTY_MESSAGES.QUALITY_DESCRIPTION,
        icon: Award,
        action: {
          label: EMPTY_MESSAGES.QUALITY_RESET,
          handler: () => {
            filters.selectedQualityBuckets = [];
          },
        },
      };
    }
    if (activeFilters.mediaTypes) {
      const isSequence = filters.selectedMediaTypes.includes("sequence");
      return {
        title: EMPTY_MESSAGES.MEDIA_TYPE_TITLE,
        description: EMPTY_MESSAGES.MEDIA_TYPE_DESCRIPTION,
        icon: isSequence ? SquarePlay : ImageIcon,
        action: {
          label: EMPTY_MESSAGES.MEDIA_TYPE_RESET,
          handler: () => {
            filters.selectedMediaTypes = [];
          },
        },
      };
    }
    if (activeFilters.onlySnapshots) {
      return {
        title: EMPTY_MESSAGES.ONLY_SNAPSHOTS_TITLE,
        description: EMPTY_MESSAGES.ONLY_SNAPSHOTS_DESCRIPTION,
        icon: Camera,
        action: {
          label: EMPTY_MESSAGES.ONLY_SNAPSHOTS_RESET,
          handler: () => {
            filters.onlySnapshots = false;
          },
        },
      };
    }
    // Fallback/Default
    return {
      title: EMPTY_MESSAGES.GENERIC_TITLE,
      description: EMPTY_MESSAGES.GENERIC_DESCRIPTION,
      icon: Filter,
      action: { label: EMPTY_MESSAGES.RESET_ALL, handler: () => filters.reset() },
    };
  });

  let resetDialogOpen = $state(false);
  let dayToReset = $state<string | null>(null);

  async function handleResetOrder() {
    if (!dayToReset) return;

    await smartToast(clearImageOrder(dayToReset), {
      loading: "Resetuji pořadí fotek...",
      success: "Pořadí fotek bylo obnoveno dle data pořízení (EXIF).",
      error: "Nepodařilo se resetovat pořadí fotek.",
    });

    resetDialogOpen = false;
    dayToReset = null;
  }
</script>

<Hero />

{#if filters.visiblePhotos === 0 && filters.sourceData.length > 0}
  <section class="container mx-auto px-6 py-12">
    <GalleryEmptyState
      title={activeEmptyState.title}
      description={activeEmptyState.description}
      icon={activeEmptyState.icon}
      action={activeEmptyState.action}
    />
  </section>
{:else if photoDays.length === 0 && filters.sourceData.length === 0}
  <section class="container mx-auto px-6 py-12 text-center">
    <GalleryEmptyState
      title={EMPTY_MESSAGES.NO_DATA_TITLE}
      description={EMPTY_MESSAGES.NO_DATA_DESCRIPTION}
      icon={Database}
    />
  </section>
{:else}
  <div use:useFancybox>
    {#each photoDays as day (day.id ?? `day-${day.date}`)}
      {@const daySectionId = day.id ?? `day-${day.date}`}
      {#if day.items.length > 0}
        <section
          id={daySectionId}
          class="container mx-auto px-6 py-8"
          use:useScrollspy={{ id: daySectionId }}
        >
          <div data-cy="day-head" class="group relative mx-auto my-12 max-w-xl text-center">
            <h2 class="mb-1 text-3xl leading-snug">
              {#if day.mergedDates}
                <span
                  class="mb-1 block text-xs font-normal tracking-[0.05em] uppercase before:mr-4 before:tracking-[-0.3em] before:opacity-[0.34] before:content-['———'] after:ml-3 after:tracking-[-0.3em] after:opacity-[0.34] after:content-['———']"
                >
                  {#if day.mergedDates.length === 2}
                    {formatWeekdayCzech(day.mergedDates[0])} a {formatWeekdayCzech(
                      day.mergedDates[1],
                    )}
                  {:else}
                    {formatWeekdayCzech(day.mergedDates[0])}—{formatWeekdayCzech(
                      day.mergedDates[day.mergedDates.length - 1],
                    )}
                  {/if}
                </span>
                {formatDateRange(day.mergedDates)}
              {:else}
                <span
                  class="mb-1 block text-xs font-normal tracking-[0.05em] uppercase before:mr-4 before:tracking-[-0.3em] before:opacity-[0.34] before:content-['———'] after:ml-3 after:tracking-[-0.3em] after:opacity-[0.34] after:content-['———']"
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
              <div data-cy="day-where" class="mx-auto mb-5 flex flex-wrap justify-center gap-2">
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
                dayImageIds.length > 0 &&
                dayImageIds.every((id: string) => editor.selection.has(id))}
              <div class="mt-4 flex justify-center gap-2 opacity-100 transition-opacity">
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
                <Button
                  variant="outline"
                  size="sm"
                  class="gap-2"
                  onclick={() => {
                    dayToReset = daySectionId;
                    resetDialogOpen = true;
                  }}
                >
                  <RotateCcw size={14} />
                  Resetovat pořadí
                </Button>
              </div>
            {/if}
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <PhotoGrid
              items={day.items}
              dayId={daySectionId}
              curationManifest={data.curationManifest}
            />
          </div>
        </section>
      {/if}
    {/each}
  </div>
{/if}

<Dialog.Root bind:open={resetDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Obnovit původní pořadí?</Dialog.Title>
      <Dialog.Description class="pt-2">
        Tato akce zruší veškeré manuální úpravy pořadí pro vybraný den a seřadí fotky chronologicky
        podle času pořízení (EXIF).
        <br /><br />
        Nastavené časy (ReleaseDate) budou přepsány původním časem pořízení. Tato akce je nevratná.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => {
          resetDialogOpen = false;
          dayToReset = null;
        }}
      >
        Zrušit
      </Button>
      <Button variant="destructive" onclick={handleResetOrder}>Obnovit pořadí</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

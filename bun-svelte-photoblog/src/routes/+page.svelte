<script lang="ts">
  import PhotoGrid from '$lib/components/PhotoGrid.svelte';
  import { Badge } from '$lib/components/ui/badge/';
  import Hero from '$lib/components/Hero.svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  const days = data.dataset || [];

  function fmtDate(d: string | Date): string {
    try {
      return new Intl.DateTimeFormat('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }).format(new Date(d));
    } catch {
      return String(d);
    }
  }

  function weekdayCS(d: string | Date): string {
    try {
      return new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' }).format(
        new Date(d),
      );
    } catch {
      return String(d);
    }
  }
</script>

{#if true}
  <Hero />
{/if}

<main>
  {#each days as day, dayIndex (day.date)}
    {@const sectionId = day.id ?? 'day-' + day.date}
    <section id={sectionId} class="container mx-auto py-8">
      <div data-cy="day-head" class="max-w-xl mx-auto text-center mb-12">
        <h2 class="mb-1 text-3xl">
          <span
            class="block mb-1 text-xs font-normal tracking-[0.05em] uppercase before:content-['———'] before:tracking-[-0.3em] before:opacity-[0.34] before:mr-4 after:content-['———'] after:tracking-[-0.3em] after:opacity-[0.34] after:ml-3"
            >{weekdayCS(day.date)}</span
          >
          {fmtDate(day.date)}
        </h2>

        {#if day.cities && day.cities.length > 0}
          <div data-cy="day-cities" class="mb-6 text-lg">
            {day.cities.join(' — ')}
          </div>
        {/if}

        {#if day.locations && day.locations.length > 0}
          <div
            data-cy="day-where"
            class="mx-auto mb-5 gap-2 flex flex-wrap justify-center"
          >
            {#each day.locations as location (location)}
              <Badge variant="secondary">{location}</Badge>
            {/each}
          </div>
        {/if}
      </div>

      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <PhotoGrid items={day.items} />
      </div>
    </section>
  {/each}
</main>

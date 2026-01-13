<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";
  import * as m from "$lib/paraglide/messages";
  import { filters } from "$lib/stores/filters.svelte";
  import { people } from "$lib/stores/people.svelte";
  import type { Person } from "$lib/types/manifest";

  function getThumbnailSrc(person: Person) {
    if (!person.thumbnail) return "";
    return `/${person.thumbnail}`;
  }
</script>

<Accordion.Item value="people" class="px-6 py-1" data-testid="filters-accordion-item-people">
  <Accordion.Trigger
    class="py-3 text-sm font-semibold no-underline"
    data-testid="filters-accordion-trigger-people"
  >
    {m.filters_people_title()}
  </Accordion.Trigger>
  <Accordion.Content>
    <div class="mb-2 flex w-full justify-between gap-x-2" data-testid="filters-tab-people-control">
      <Button
        variant="outline"
        size="sm"
        title={m.filters_people_only_with()}
        class="h-7 px-3 text-xs"
        onclick={(e) => {
          e.stopPropagation();
          filters.setPeopleWithPeople();
        }}
        data-testid="filter-people-only-with-people"
      >
        {m.filters_people_only_with()}
      </Button>
      <Button
        variant="outline"
        size="sm"
        title={m.filters_people_without()}
        class="h-7 px-3 text-xs"
        onclick={(e) => {
          e.stopPropagation();
          filters.setPeopleNone();
        }}
        data-testid="filter-people-without-people"
      >
        {m.filters_people_without()}
      </Button>

      <Button
        variant={filters.selectedPeople.length > 0 ? "default" : "outline"}
        size="sm"
        class="ml-auto h-7 px-3 text-xs"
        disabled={filters.selectedPeople.length === 0}
        onclick={(e) => {
          e.stopPropagation();
          filters.selectedPeople = [];
        }}
        title={m.filters_reset_title()}
        data-testid="filter-people-reset"
      >
        {m.filters_people_all()}
      </Button>
    </div>
    <div class="grid grid-cols-2 gap-x-12 gap-y-2 pb-4">
      {#each people.displayPersons.filter((p) => p.isUserNamed) as person (person.id)}
        {@const isChecked =
          filters.selectedPeople.length === 0 || filters.selectedPeople.includes(person.id)}

        <div
          class="flex items-center justify-between"
          data-testid={`filter-row-person-${person.id}`}
        >
          <div
            class="border-border relative size-12 shrink-0 overflow-hidden rounded-full border bg-slate-100 dark:bg-slate-800"
          >
            <img
              src={getThumbnailSrc(person)}
              alt={person.name}
              class="h-full w-full object-cover"
            />
          </div>

          <Button
            variant="link"
            size="sm"
            title={m.filters_people_show_only_limit()}
            class="text-xs"
            onclick={(e) => {
              e.stopPropagation();
              filters.setPersonSolo(person.id);
            }}
            data-testid={`filter-solo-person-${person.id}`}
          >
            {m.filters_people_solo_count({ count: person.faceCount })}
          </Button>

          <Button
            variant={isChecked ? "outline" : "ghost"}
            size="icon"
            title={isChecked ? m.filters_hide_title() : m.filters_show_title()}
            class="text-primary size-8"
            onclick={(e) => {
              e.stopPropagation();
              const current = filters.selectedPeople;
              const allNamed = people.displayPersons.filter((p) => p.isUserNamed).map((p) => p.id);
              let next = current;

              if (current.length === 0) next = allNamed;
              else if (current.includes("none")) next = [];

              if (!isChecked) next = [...next, person.id];
              else next = next.filter((id) => id !== person.id);

              // Normalize
              if (next.length === 0) filters.selectedPeople = ["none"];
              else if (next.length === allNamed.length) filters.selectedPeople = [];
              else filters.selectedPeople = next;
            }}
            data-testid={`filter-visibility-person-${person.id}`}
          >
            {#if isChecked}
              <Eye class="size-4" strokeWidth={2.5} />
            {:else}
              <EyeOff class="size-4" strokeWidth={2.5} />
            {/if}
          </Button>
        </div>
      {/each}
      <p class="col-span-2 pt-1 text-xs text-slate-400"></p>
      <p class="col-span-2 pt-1 text-xs text-slate-400">
        {m.filters_people_hint()}
      </p>
    </div>
  </Accordion.Content>
</Accordion.Item>

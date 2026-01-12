<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge/";
  import { Button } from "$lib/components/ui/button";
  import { createLogger } from "$lib/logger";
  import { filters } from "$lib/stores/filters.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import { toSlug } from "$lib/utils/strings";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let { authors = [] } = $props<{
    authors: AuthorStats[];
  }>();

  const logger = createLogger("AuthorsFilter");

  function getAuthorSlug(a: AuthorStats) {
    return a.slug ?? toSlug(a.name);
  }

  function isAuthorActive(slug: string): boolean {
    if (filters.selectedAuthors.length === 0) return true;
    return filters.selectedAuthors.includes(slug) && !filters.selectedAuthors.includes("none");
  }

  function toggleAuthor(slug: string, displayName?: string) {
    const previous = filters.selectedAuthors;
    if (ui.debugMode) {
      logger.debug({ slug, name: displayName, previous }, "filters: toggleAuthor start");
    }

    let effectiveCurrent = filters.selectedAuthors;

    if (filters.selectedAuthors.length === 0) {
      effectiveCurrent = authors.map(getAuthorSlug);
    } else if (filters.selectedAuthors.includes("none")) {
      effectiveCurrent = [];
    }

    const isSelected = effectiveCurrent.includes(slug);
    let next: string[];

    if (isSelected) {
      next = effectiveCurrent.filter((s) => s !== slug);
    } else {
      next = [...effectiveCurrent, slug];
    }

    const allSlugs = authors.map(getAuthorSlug);

    if (next.length === 0) {
      filters.selectedAuthors = ["none"];
      return;
    }

    if (next.length === allSlugs.length) {
      filters.selectedAuthors = [];
      return;
    }

    filters.selectedAuthors = next;
  }
</script>

{#if authors.length > 0}
  <Accordion.Item value="authors" class="px-6 py-1" data-testid="filters-accordion-item-authors">
    <Accordion.Trigger
      class="py-3 text-sm font-semibold no-underline"
      data-testid="filters-accordion-trigger-authors"
    >
      Autoři
    </Accordion.Trigger>

    <Accordion.Content>
      <div
        class="mb-2 flex w-full justify-between gap-x-2"
        data-testid="filters-tab-authors-control"
      >
        <Button
          variant="outline"
          size="sm"
          title="Skrýt všechny autory"
          class="h-7 px-3 text-xs"
          onclick={(e) => {
            e.stopPropagation();
            filters.setAuthorsNone();
          }}
          data-testid="filter-authors-hide-all"
        >
          Bez autorů
        </Button>

        <Button
          variant={filters.selectedAuthors.length > 0 ? "default" : "outline"}
          size="sm"
          class="ml-auto h-7 px-3 text-xs"
          disabled={filters.selectedAuthors.length === 0}
          onclick={(e) => {
            e.stopPropagation();
            filters.setAuthorsAll();
          }}
          title="Resetovat filtr"
          data-testid="filter-authors-reset"
        >
          Všechno
        </Button>
      </div>

      <div class="flex flex-col gap-x-2" data-testid="filters-tab-authors">
        {#each authors as author (author.name)}
          {@const slugKey = author.slug ?? toSlug(author.name)}
          {@const isActive = isAuthorActive(slugKey)}

          <div
            class="group flex h-9 items-center justify-between"
            data-testid={`filter-row-author-${slugKey}`}
          >
            <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <span
                class={`truncate text-sm ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}
                title={author.name}
              >
                {author.name}
              </span>
              <Badge
                variant="secondary"
                class="text-muted-foreground h-5 min-w-[1.5rem] justify-center px-1.5 text-[10px] font-normal"
              >
                {author.count}
              </Badge>
            </div>

            <Button
              variant="link"
              size="sm"
              title="Zobrazit pouze tohoto autora"
              class="text-xs"
              onclick={(e) => {
                e.stopPropagation();
                filters.setAuthorSolo(slugKey);
              }}
              data-testid={`filter-solo-author-${slugKey}`}
            >
              Pouze
            </Button>

            <Button
              variant={isActive ? "outline" : "ghost"}
              size="icon"
              title={isActive ? "Skrýt" : "Zobrazit"}
              class="text-primary size-8"
              onclick={() => toggleAuthor(slugKey, author.name)}
              data-testid={`filter-visibility-author-${slugKey}`}
            >
              {#if isActive}
                <Eye class="size-4" strokeWidth={2.5} />
              {:else}
                <EyeOff class="size-4" strokeWidth={2.5} />
              {/if}
            </Button>
          </div>
        {/each}
        <p class="pt-1 text-xs text-slate-400">
          Zobrazí se fotky od vybraných autorů. Pokud není vybrán nikdo, galerie bude prázdná.
        </p>
      </div>
    </Accordion.Content>
  </Accordion.Item>
{/if}

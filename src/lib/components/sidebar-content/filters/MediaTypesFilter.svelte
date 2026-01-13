<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge/";
  import { Button } from "$lib/components/ui/button";
  import * as m from "$lib/paraglide/messages";
  import { MEDIA_TYPES, filters } from "$lib/stores/filters.svelte";
  import type { MediaItemType } from "$lib/types/manifest";

  const TYPE_LABELS: Record<string, () => string> = {
    image: m.media_type_image,
    panorama: m.media_type_panorama,
    sequence: m.media_type_sequence,
    collage: m.media_type_collage,
  };

  let { mediaStats = new Map() } = $props<{
    mediaStats: Map<string, number>;
  }>();

  function isMediaTypeActive(typeId: MediaItemType): boolean {
    if (filters.selectedMediaTypes.length === 0) return true;
    return (
      filters.selectedMediaTypes.includes(typeId) &&
      !filters.selectedMediaTypes.includes("none" as MediaItemType)
    );
  }

  function handleMediaTypeToggle(typeId: MediaItemType, checked: boolean) {
    let current = filters.selectedMediaTypes;
    // Handle special "none" case
    if (current.includes("none" as MediaItemType)) {
      current = [];
    } else if (current.length === 0) {
      current = MEDIA_TYPES.map((t) => t.id);
    }

    if (checked) {
      current = [...current, typeId];
    } else {
      current = current.filter((id) => id !== typeId);
    }

    if (current.length === 0) {
      filters.selectedMediaTypes = ["none" as MediaItemType];
    } else if (current.length === MEDIA_TYPES.length) {
      filters.selectedMediaTypes = [];
    } else {
      filters.selectedMediaTypes = current;
    }
  }
</script>

<Accordion.Item
  value="media-types"
  class="px-6 py-1"
  data-testid="filters-accordion-item-media-types"
>
  <Accordion.Trigger
    class="py-3 text-sm font-semibold no-underline"
    data-testid="filters-accordion-trigger-media-types"
  >
    {m.filters_mediatypes_title()}
  </Accordion.Trigger>
  <Accordion.Content>
    <div class="mb-2 flex w-full justify-end gap-x-2" data-testid="filters-tab-mediatypes-control">
      <Button
        variant={filters.selectedMediaTypes.length > 0 ? "default" : "outline"}
        size="sm"
        class="ml-auto h-7 px-3 text-xs"
        disabled={filters.selectedMediaTypes.length === 0}
        onclick={(e) => {
          e.stopPropagation();
          filters.setMediaTypesAll();
        }}
        title={m.filters_reset_title()}
        data-testid="filter-mediatypes-show-all"
      >
        {m.filters_mediatypes_all()}
      </Button>
    </div>

    <div class="flex flex-col gap-2">
      {#each MEDIA_TYPES as type}
        {@const isChecked = isMediaTypeActive(type.id)}
        {@const count = mediaStats.get(type.id) ?? 0}

        <div
          class="group flex h-9 items-center justify-between"
          data-testid={`filter-row-mediatype-${type.id}`}
        >
          <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span
              class={`truncate text-sm ${isChecked && count > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {TYPE_LABELS[type.id]?.() ?? type.label}
            </span>
            <Badge
              variant="secondary"
              class="text-muted-foreground h-5 min-w-[1.5rem] justify-center px-1.5 text-[10px] font-normal"
            >
              {count}
            </Badge>
          </div>

          <Button
            variant="link"
            size="sm"
            title={m.filters_mediatypes_show_only_title()}
            class="text-xs"
            disabled={count === 0}
            onclick={(e) => {
              e.stopPropagation();
              filters.setMediaTypeSolo(type.id);
            }}
            data-testid={`filter-solo-mediatype-${type.id}`}
          >
            {m.filters_authors_solo()}
          </Button>

          <Button
            variant={isChecked ? "outline" : "ghost"}
            size="icon"
            title={isChecked ? m.filters_hide_title() : m.filters_show_title()}
            class="text-primary size-8"
            disabled={count === 0}
            onclick={() => handleMediaTypeToggle(type.id, !isChecked)}
            data-testid={`filter-visibility-mediatype-${type.id}`}
          >
            {#if isChecked}
              <Eye class="size-4" strokeWidth={2.5} />
            {:else}
              <EyeOff class="size-4" strokeWidth={2.5} />
            {/if}
          </Button>
        </div>
      {/each}
      <p class="pt-1 text-xs text-slate-400">
        {m.filters_mediatypes_hint()}
      </p>
    </div>
  </Accordion.Content>
</Accordion.Item>

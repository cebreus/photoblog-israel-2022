<script lang="ts">
  import { Eye, EyeOff } from "@lucide/svelte";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge/";
  import { Button } from "$lib/components/ui/button";
  import * as m from "$lib/paraglide/messages";
  import { filters } from "$lib/stores/filters.svelte";
  import type { QualityFilterBucket } from "$lib/types/manifest";
  import { QUALITY_BUCKETS } from "$lib/utils/gallery";

  let { qualityStats = new Map(), qualityCount = 0 } = $props<{
    qualityStats: Map<string, number>;
    qualityCount: number;
  }>();

  function isQualityActive(bucketId: QualityFilterBucket): boolean {
    if (filters.selectedQualityBuckets.length === 0) return true;
    return (
      filters.selectedQualityBuckets.includes(bucketId) &&
      !filters.selectedQualityBuckets.includes("none" as unknown as QualityFilterBucket)
    );
  }

  function toggleQualityBucket(id: QualityFilterBucket) {
    let current = filters.selectedQualityBuckets;

    if (current.includes("none" as unknown as QualityFilterBucket)) {
      current = [];
    } else if (current.length === 0) {
      current = QUALITY_BUCKETS.map((b) => b.id);
    }

    if (current.includes(id)) {
      current = current.filter((i) => i !== id);
    } else {
      current = [...current, id];
    }

    if (current.length === 0) {
      filters.selectedQualityBuckets = ["none" as unknown as QualityFilterBucket];
    } else if (current.length === QUALITY_BUCKETS.length) {
      filters.selectedQualityBuckets = [];
    } else {
      filters.selectedQualityBuckets = current;
    }
  }

  // Derive global states for header buttons
  let isAllVisible = $derived(filters.selectedQualityBuckets.length === 0);
</script>

{#if qualityStats.size > 0 && qualityCount > 0}
  <Accordion.Item value="quality" class="px-6 py-1" data-testid="filters-accordion-item-quality">
    <Accordion.Trigger
      class="py-3 hover:no-underline"
      data-testid="filters-accordion-trigger-quality"
    >
      <span class="text-sm font-semibold">{m.filters_quality_title()}</span>
    </Accordion.Trigger>
    <Accordion.Content>
      <div class="mb-2 flex w-full justify-end gap-x-2" data-testid="filters-tab-quality-control">
        <Button
          variant={isAllVisible ? "outline" : "default"}
          size="sm"
          class="ml-auto h-7 px-3 text-xs"
          disabled={isAllVisible}
          onclick={(e) => {
            e.stopPropagation();
            filters.selectedQualityBuckets = [];
          }}
          title={m.filters_quality_show_all_title()}
          data-testid="filter-quality-show-all"
        >
          {m.filters_quality_show_all()}
        </Button>
      </div>

      <div class="flex flex-col gap-x-2">
        {#each QUALITY_BUCKETS as bucket (bucket.id)}
          {@const count = qualityStats.get(bucket.id) ?? 0}
          {@const isActive = isQualityActive(bucket.id)}

          <div
            class="group flex h-9 items-center justify-between"
            data-testid={`filter-row-quality-${bucket.id}`}
          >
            <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <span
                class={`truncate text-sm ${isActive && count > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}
              >
                {bucket.label}
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
              title={m.filters_quality_show_only()}
              class="text-xs"
              disabled={count === 0}
              onclick={(e) => {
                e.stopPropagation();
                filters.selectedQualityBuckets = [bucket.id];
              }}
              data-testid={`filter-solo-quality-${bucket.id}`}
            >
              {m.filters_authors_solo()}
            </Button>

            <Button
              variant={isActive ? "outline" : "ghost"}
              size="icon"
              title={isActive ? m.filters_hide_title() : m.filters_show_title()}
              class="text-primary size-8"
              disabled={count === 0}
              onclick={() => toggleQualityBucket(bucket.id)}
              data-testid={`filter-visibility-quality-${bucket.id}`}
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
          {m.filters_quality_hint()}
        </p>
      </div>
    </Accordion.Content>
  </Accordion.Item>
{/if}

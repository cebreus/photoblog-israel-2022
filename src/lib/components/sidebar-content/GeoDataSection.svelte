<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";
  import * as m from "$lib/paraglide/messages";

  import MetadataInputField from "./MetadataInputField.svelte";

  type GeoField = "location" | "city" | "state" | "country" | "countryCode";

  let {
    location,
    city,
    state,
    country,
    countryCode,
    previousValues,
    clearedFields,
    onFieldInput,
    onFieldClear,
    onRestore,
    onFetchGeo,
    isFetching,
    hasGpsCoords,
    googleMapsUrl,
  } = $props<{
    location: string;
    city: string;
    state: string;
    country: string;
    countryCode: string;
    previousValues: Record<string, string | undefined>;
    clearedFields: Record<string, boolean | undefined>;
    onFieldInput: (field: GeoField, value: string) => void;
    onFieldClear: (field: GeoField) => void;
    onRestore: (field: GeoField) => void;
    onFetchGeo: () => void;
    isFetching: boolean;
    hasGpsCoords: boolean;
    googleMapsUrl?: string;
  }>();
</script>

<Accordion.Root type="single" value="geo">
  <Accordion.Item value="geo">
    <Accordion.Trigger class="text-sm font-medium">{m.image_geo_label()}</Accordion.Trigger>
    <Accordion.Content class="mb-2 border-b">
      <div class="space-y-4 pt-2">
        <!-- Location -->
        <div class="space-y-2">
          <MetadataInputField
            label={m.image_label_location()}
            name="location"
            value={location}
            onInput={(v) => onFieldInput("location", v)}
            onClear={() => onFieldClear("location")}
            isCleared={clearedFields.location}
          />
          {#if previousValues.location !== undefined}
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-foreground group mt-1 flex h-auto items-center gap-1 p-0 text-xs transition-colors hover:bg-transparent"
              onclick={() => onRestore("location")}
              aria-label={m.image_restore_value_aria()}
            >
              <RotateCcw size={10} class="transition-transform group-hover:-rotate-90" />
              {m.image_original_value()}
              <span class="bg-muted rounded px-1 font-mono">{previousValues.location || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- City -->
        <div class="space-y-2">
          <MetadataInputField
            label={m.image_label_city()}
            name="city"
            value={city}
            onInput={(v) => onFieldInput("city", v)}
            onClear={() => onFieldClear("city")}
            isCleared={clearedFields.city}
          />
          {#if previousValues.city !== undefined}
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-foreground group mt-1 flex h-auto items-center gap-1 p-0 text-xs transition-colors hover:bg-transparent"
              onclick={() => onRestore("city")}
              aria-label={m.image_restore_value_aria()}
            >
              <RotateCcw size={10} class="transition-transform group-hover:-rotate-90" />
              {m.image_original_value()}
              <span class="bg-muted rounded px-1 font-mono">{previousValues.city || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- State -->
        <div class="space-y-2">
          <MetadataInputField
            label={m.image_label_state()}
            name="state"
            value={state}
            onInput={(v) => onFieldInput("state", v)}
            onClear={() => onFieldClear("state")}
            isCleared={clearedFields.state}
          />
          {#if previousValues.state !== undefined}
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-foreground group mt-1 flex h-auto items-center gap-1 p-0 text-xs transition-colors hover:bg-transparent"
              onclick={() => onRestore("state")}
              aria-label={m.image_restore_value_aria()}
            >
              <RotateCcw size={10} class="transition-transform group-hover:-rotate-90" />
              {m.image_original_value()}
              <span class="bg-muted rounded px-1 font-mono">{previousValues.state || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- Country -->
        <div class="space-y-2">
          <MetadataInputField
            label={m.image_label_country()}
            name="country"
            value={country}
            onInput={(v) => onFieldInput("country", v)}
            onClear={() => onFieldClear("country")}
            isCleared={clearedFields.country}
          />
          {#if previousValues.country !== undefined}
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-foreground group mt-1 flex h-auto items-center gap-1 p-0 text-xs transition-colors hover:bg-transparent"
              onclick={() => onRestore("country")}
              aria-label={m.image_restore_value_aria()}
            >
              <RotateCcw size={10} class="transition-transform group-hover:-rotate-90" />
              {m.image_original_value()}
              <span class="bg-muted rounded px-1 font-mono">{previousValues.country || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- Country Code -->
        <div class="space-y-2">
          <MetadataInputField
            label={m.image_label_country_code()}
            name="countryCode"
            value={countryCode}
            onInput={(v) => onFieldInput("countryCode", v)}
            onClear={() => onFieldClear("countryCode")}
            isCleared={clearedFields.countryCode}
          />
          {#if previousValues.countryCode !== undefined}
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-foreground group mt-1 flex h-auto items-center gap-1 p-0 text-xs transition-colors hover:bg-transparent"
              onclick={() => onRestore("countryCode")}
              aria-label={m.image_restore_value_aria()}
            >
              <RotateCcw size={10} class="transition-transform group-hover:-rotate-90" />
              {m.image_original_value()}
              <span class="bg-muted rounded px-1 font-mono"
                >{previousValues.countryCode || "∅"}</span
              >
            </Button>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-2">
          {#if googleMapsUrl}
            <Button
              variant="link"
              size="sm"
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={m.image_open_in_maps_aria()}
            >
              Google Maps
            </Button>
          {/if}
          <Button
            variant="outline"
            size="sm"
            class="flex-1 gap-2"
            onclick={onFetchGeo}
            disabled={isFetching || !hasGpsCoords}
            aria-label={m.image_fetch_from_gps_aria()}
          >
            {#if isFetching}
              {m.image_fetching()}
            {:else}
              {m.image_fetch_from_map()}
            {/if}
          </Button>
        </div>
      </div>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>

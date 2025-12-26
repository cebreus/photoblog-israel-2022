<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";
  import { IMAGE_MESSAGES } from "$lib/utils/messages";

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
    <Accordion.Trigger class="text-sm font-medium">{IMAGE_MESSAGES.GEO_LABEL}</Accordion.Trigger>
    <Accordion.Content class="border-b mb-2">
      <div class="space-y-4 pt-2">
        <!-- Location -->
        <div class="space-y-2">
          <MetadataInputField
            label={IMAGE_MESSAGES.LABEL_LOCATION}
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
              class="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("location")}
              aria-label={IMAGE_MESSAGES.RESTORE_VALUE_ARIA}
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              {IMAGE_MESSAGES.ORIGINAL_VALUE}
              <span class="font-mono bg-muted px-1 rounded">{previousValues.location || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- City -->
        <div class="space-y-2">
          <MetadataInputField
            label={IMAGE_MESSAGES.LABEL_CITY}
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
              class="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("city")}
              aria-label={IMAGE_MESSAGES.RESTORE_VALUE_ARIA}
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              {IMAGE_MESSAGES.ORIGINAL_VALUE}
              <span class="font-mono bg-muted px-1 rounded">{previousValues.city || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- State -->
        <div class="space-y-2">
          <MetadataInputField
            label={IMAGE_MESSAGES.LABEL_STATE}
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
              class="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("state")}
              aria-label={IMAGE_MESSAGES.RESTORE_VALUE_ARIA}
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              {IMAGE_MESSAGES.ORIGINAL_VALUE}
              <span class="font-mono bg-muted px-1 rounded">{previousValues.state || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- Country -->
        <div class="space-y-2">
          <MetadataInputField
            label={IMAGE_MESSAGES.LABEL_COUNTRY}
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
              class="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("country")}
              aria-label={IMAGE_MESSAGES.RESTORE_VALUE_ARIA}
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              {IMAGE_MESSAGES.ORIGINAL_VALUE}
              <span class="font-mono bg-muted px-1 rounded">{previousValues.country || "∅"}</span>
            </Button>
          {/if}
        </div>

        <!-- Country Code -->
        <div class="space-y-2">
          <MetadataInputField
            label={IMAGE_MESSAGES.LABEL_COUNTRY_CODE}
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
              class="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("countryCode")}
              aria-label={IMAGE_MESSAGES.RESTORE_VALUE_ARIA}
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              {IMAGE_MESSAGES.ORIGINAL_VALUE}
              <span class="font-mono bg-muted px-1 rounded"
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
              aria-label={IMAGE_MESSAGES.OPEN_IN_MAPS_ARIA}
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
            aria-label={IMAGE_MESSAGES.FETCH_FROM_GPS_ARIA}
          >
            {#if isFetching}
              {IMAGE_MESSAGES.FETCHING}
            {:else}
              {IMAGE_MESSAGES.FETCH_FROM_MAP}
            {/if}
          </Button>
        </div>
      </div>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>

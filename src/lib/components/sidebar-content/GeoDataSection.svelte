<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";

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
    <Accordion.Trigger class="text-sm font-medium">Geografické údaje</Accordion.Trigger>
    <Accordion.Content class="border-b mb-2">
      <div class="space-y-4 pt-2">
        <!-- Location -->
        <div class="space-y-2">
          <MetadataInputField
            label="Místo"
            name="location"
            value={location}
            onInput={(v) => onFieldInput("location", v)}
            onClear={() => onFieldClear("location")}
            isCleared={clearedFields.location}
          />
          {#if previousValues.location !== undefined}
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("location")}
              aria-label="Kliknutím vrátíte původní hodnotu"
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              Původní:
              <span class="font-mono bg-muted px-1 rounded">{previousValues.location || "∅"}</span>
            </button>
          {/if}
        </div>

        <!-- City -->
        <div class="space-y-2">
          <MetadataInputField
            label="Město"
            name="city"
            value={city}
            onInput={(v) => onFieldInput("city", v)}
            onClear={() => onFieldClear("city")}
            isCleared={clearedFields.city}
          />
          {#if previousValues.city !== undefined}
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("city")}
              aria-label="Kliknutím vrátíte původní hodnotu"
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              Původní:
              <span class="font-mono bg-muted px-1 rounded">{previousValues.city || "∅"}</span>
            </button>
          {/if}
        </div>

        <!-- State -->
        <div class="space-y-2">
          <MetadataInputField
            label="Stát / Provincie"
            name="state"
            value={state}
            onInput={(v) => onFieldInput("state", v)}
            onClear={() => onFieldClear("state")}
            isCleared={clearedFields.state}
          />
          {#if previousValues.state !== undefined}
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("state")}
              aria-label="Kliknutím vrátíte původní hodnotu"
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              Původní:
              <span class="font-mono bg-muted px-1 rounded">{previousValues.state || "∅"}</span>
            </button>
          {/if}
        </div>

        <!-- Country -->
        <div class="space-y-2">
          <MetadataInputField
            label="Země"
            name="country"
            value={country}
            onInput={(v) => onFieldInput("country", v)}
            onClear={() => onFieldClear("country")}
            isCleared={clearedFields.country}
          />
          {#if previousValues.country !== undefined}
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("country")}
              aria-label="Kliknutím vrátíte původní hodnotu"
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              Původní:
              <span class="font-mono bg-muted px-1 rounded">{previousValues.country || "∅"}</span>
            </button>
          {/if}
        </div>

        <!-- Country Code -->
        <div class="space-y-2">
          <MetadataInputField
            label="Kód"
            name="countryCode"
            value={countryCode}
            onInput={(v) => onFieldInput("countryCode", v)}
            onClear={() => onFieldClear("countryCode")}
            isCleared={clearedFields.countryCode}
          />
          {#if previousValues.countryCode !== undefined}
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1 transition-colors group"
              onclick={() => onRestore("countryCode")}
              aria-label="Kliknutím vrátíte původní hodnotu"
            >
              <RotateCcw size={10} class="group-hover:-rotate-90 transition-transform" />
              Původní:
              <span class="font-mono bg-muted px-1 rounded"
                >{previousValues.countryCode || "∅"}</span
              >
            </button>
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
              aria-label="Otevřít v Google Maps"
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
            aria-label="Načíst adresu z GPS souřadnic"
          >
            {#if isFetching}
              Načítám...
            {:else}
              Načíst z mapy
            {/if}
          </Button>
        </div>
      </div>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>

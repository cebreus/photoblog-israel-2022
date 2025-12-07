<script lang="ts">
    import { buttonVariants } from "$lib/components/ui/button/button.svelte";
    import * as Offcanvas from "$lib/components/offcanvas";
    import { showLocationPins } from "$lib/stores/mapLocations";
    import { Switch } from "$lib/components/ui/switch";
    import { SlidersHorizontal } from "@lucide/svelte";
</script>

<Offcanvas.Root>
    <Offcanvas.Trigger
        class={buttonVariants({
            size: "icon",
            variant: "ghost",
        })}
    >
        <SlidersHorizontal strokeWidth={2.5} />
    </Offcanvas.Trigger>

    <Offcanvas.Content
        side="right"
        className="overflow-y-auto text-foreground"
        data-testid="filters-offcanvas"
    >
        <div class="py-4 px-6 border-b">
            <h2 class="text-md font-semibold">Filtry</h2>
        </div>
        <div class="px-6 py-4 border-b flex items-center justify-between gap-4">
            <div>
                <p class="text-sm font-semibold">Zobrazit lokace</p>
                <p class="text-xs text-slate-400">
                    Zobrazí popisky nad obrázky
                </p>
            </div>
            <Switch
                bind:checked={$showLocationPins}
                aria-label={$showLocationPins
                    ? "Skrýt lokace"
                    : "Zobrazit lokace"}
            />
        </div>
    </Offcanvas.Content>
</Offcanvas.Root>

<script lang="ts">
  import type { MenuManifest } from "$lib/types/manifest";
  import {
    Menu,
    ChevronRight,
    Calendar,
    MapPin,
    MapPinOff,
  } from "@lucide/svelte";
  import Button, {
    buttonVariants,
  } from "$lib/components/ui/button/button.svelte";
  import * as Offcanvas from "$lib/components/offcanvas";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Collapsible } from "bits-ui";
  import { page } from "$app/stores";
  import { activeSectionIds } from "$lib/stores/scrollspy";
  import { showLocationPins } from "$lib/stores/mapLocations";

  export let menuItems: MenuManifest = [];
</script>

<header
  class="sticky top-0 border-b bg-slate-800 text-slate-100 z-10 border-slate-700"
>
  <div class="container mx-auto py-2.5 flex items-center gap-4">
    <div class="flex-1 flex items-center gap-8">
      <a href="/" class="text-lg font-semibold uppercase">Izrael 2022</a>
    </div>

    <Offcanvas.Root>
      <!-- new toggle button to show/hide photo location pins -->
      <Button
        onclick={() => showLocationPins.update((v) => !v)}
        aria-pressed={$showLocationPins}
        title={$showLocationPins ? "Skrýt lokace" : "Zobrazit lokace"}
        class={`${buttonVariants({ size: "icon", variant: "ghost" })} `}
      >
        {#if $showLocationPins}
          <MapPin strokeWidth={2.5} aria-label="Skrýt lokace" />
        {:else}
          <MapPinOff strokeWidth={2.5} aria-label="Zobrazit lokace" />
        {/if}
      </Button>

      <Offcanvas.Trigger
        class={buttonVariants({
          size: "icon",
          variant: "ghost",
        })}
      >
        <Menu />
      </Offcanvas.Trigger>

      <Offcanvas.Content
        side="right"
        className="overflow-y-auto text-foreground "
      >
        <div class="py-4 px-6 border-b">
          <h2 class="text-md font-semibold">Menu</h2>
        </div>
        <nav class="flex flex-col gap-2 mx-2 pr-2">
          <Sidebar.Menu>
            <Sidebar.Group>
              {#each menuItems as menuDay (menuDay.id)}
                {@const isHashActiveDay = $page.url.hash === menuDay.href}

                <Collapsible.Root open={true} class="group/collapsible">
                  {#snippet child({ props })}
                    <Sidebar.MenuItem {...props}>
                      <Sidebar.MenuButton
                        isHashActive={isHashActiveDay}
                        isScrollspyActive={false}
                      >
                        {#snippet child({ props })}
                          <div class="flex items-center w-full" {...props}>
                            <a
                              href={menuDay.href}
                              class="flex items-center gap-2 grow"
                            >
                              <Calendar class="size-4" />
                              {menuDay.label}
                            </a>
                            <Collapsible.Trigger class="ml-auto">
                              <ChevronRight
                                class="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                              />
                            </Collapsible.Trigger>
                          </div>
                        {/snippet}
                      </Sidebar.MenuButton>
                      <Collapsible.Content>
                        <Sidebar.MenuSub>
                          {#each menuDay.locations as menuLocation (menuLocation.id)}
                            {@const isHashActiveLocation =
                              $page.url.hash === menuLocation.href}
                            {@const isScrollspyActiveLocation =
                              $activeSectionIds.has(menuLocation.id)}
                            <Sidebar.MenuSubItem>
                              <Sidebar.MenuSubButton
                                href={menuLocation.href}
                                isHashActive={isHashActiveLocation}
                                isScrollspyActive={isScrollspyActiveLocation}
                                isDimmed={menuLocation.isDimmed}
                                firstPhotoExifDate={menuLocation.firstPhotoExifDate}
                              >
                                {menuLocation.label}
                              </Sidebar.MenuSubButton>
                            </Sidebar.MenuSubItem>
                          {/each}
                        </Sidebar.MenuSub>
                      </Collapsible.Content>
                    </Sidebar.MenuItem>
                  {/snippet}
                </Collapsible.Root>
              {/each}
            </Sidebar.Group>
          </Sidebar.Menu>

          <!-- <Sheet.Close
                class={buttonVariants({
                  size: 'sm',
                  variant: 'outline',
                  class: 'mr-auto mt-4',
                })}
              >
                Zavřít
              </Sheet.Close> -->
        </nav>
      </Offcanvas.Content>
    </Offcanvas.Root>
  </div>
</header>

<script lang="ts">
  import type { MenuManifest } from "$lib/types/manifest";
  import { Menu, ChevronRight, Calendar } from "@lucide/svelte";
  import Button, {
    buttonVariants,
  } from "$lib/components/ui/button/button.svelte";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Collapsible } from "bits-ui"; // Import Collapsible components directly from bits-ui
  import { page } from "$app/stores"; // Import $page store
  import { activeSectionIds } from "$lib/stores/scrollspy"; // Import the activeSectionIds store

  export let menuItems: MenuManifest = [];
</script>

<header class="sticky top-0 border-b bg-background text-foreground z-10">
  <div class="container mx-auto py-3 flex items-center gap-4">
    <div class="flex-1 flex items-center gap-8">
      <a href="/" class="text-lg font-semibold uppercase">Izrael 2022</a>
      <!-- <div class="flex items-center gap-1">
          <Button size="sm" variant="ghost" href="/">Vše</Button>
          <Button size="sm" variant="ghost" href="/best-of">Výběr</Button>
        </div> -->
    </div>

    <Sheet.Root>
      <Sheet.Trigger
        class={buttonVariants({
          size: "sm",
          variant: "ghost",
        })}
      >
        <Menu />
      </Sheet.Trigger>

      <Sheet.Content side="right" class="overflow-y-auto">
        <Sheet.Header>
          <Sheet.Title>Menu</Sheet.Title>
        </Sheet.Header>
        <nav class="flex flex-col gap-2 mx-2 pr-2">
          <!-- <Button
                variant="ghost"
                size="sm"
                href="/"
                class="w-full justify-start items-center gap-3"
              >
                <Home class="size-4" />
                <span>Vše</span>
              </Button>
  
              <Button
                variant="ghost"
                size="sm"
                href="/best-of"
                class="w-full justify-start items-center gap-3"
              >
                <Star class="size-4" />
                <span>Výběr fotek</span>
              </Button> -->

          <Sidebar.Menu>
            <Sidebar.Group>
              <!-- <Sidebar.GroupLabel>Dny</Sidebar.GroupLabel> -->
              {#each menuItems as menuDay (menuDay.id)}
                {@const isHashActiveDay = $page.url.hash === menuDay.href}
                {@const isScrollspyActiveDay = $activeSectionIds.has(
                  menuDay.id,
                )}
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
                              class="flex items-center gap-2 flex-grow"
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
      </Sheet.Content>
    </Sheet.Root>
  </div>
</header>

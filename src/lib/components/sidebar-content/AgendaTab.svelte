<script lang="ts">
  import Calendar from "@lucide/svelte/icons/calendar";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { Collapsible } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { page } from "$app/state";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { ui } from "$lib/stores/ui.svelte";
  import type { MenuManifest } from "$lib/types/manifest";

  let { menuItems = [] }: { menuItems: MenuManifest } = $props();

  // Helper function to check if a day is scrollspy active
  function isDayScrollspyActive(dayId: string, locationIds: string[]): boolean {
    return ui.activeSections.has(dayId) || locationIds.some((id) => ui.activeSections.has(id));
  }
</script>

<Sidebar.Menu data-testid="agenda-tab" class="px-2">
  <Sidebar.Group>
    {#each menuItems as menuDay (menuDay.id)}
      {@const isHashActiveDay = page.url.hash === menuDay.href}
      {@const locationIds = menuDay.locations.map((loc) => loc.id)}

      <Collapsible.Root open={true} class="group/collapsible">
        {#snippet child({ props }: { props: HTMLAttributes<HTMLElement> })}
          <Sidebar.MenuItem {...props}>
            <Sidebar.MenuButton
              isHashActive={isHashActiveDay}
              isScrollspyActive={isDayScrollspyActive(menuDay.id, locationIds)}
            >
              {#snippet child({ props }: { props: HTMLAttributes<HTMLElement> })}
                <div class="flex items-center w-full" {...props}>
                  <a href={menuDay.href} class="flex items-center gap-2 grow">
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
                  {@const isHashActiveLocation = page.url.hash === menuLocation.href}
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton
                      href={menuLocation.href}
                      isHashActive={isHashActiveLocation}
                      isScrollspyActive={ui.activeSections.has(menuLocation.id)}
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

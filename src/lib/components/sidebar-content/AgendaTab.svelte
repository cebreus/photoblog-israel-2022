<script lang="ts">
  import type { MenuManifest } from "$lib/types/manifest";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Collapsible } from "bits-ui";
  import { page } from "$app/stores";
  import { activeSectionIds } from "$lib/stores/scrollspy";
  import { Calendar, ChevronRight } from "lucide-svelte";
  import type { HTMLAttributes } from "svelte/elements";

  export let menuItems: MenuManifest = [];
</script>

<Sidebar.Menu data-testid="agenda-tab" class="px-2">
  <Sidebar.Group>
    {#each menuItems as menuDay (menuDay.id)}
      {@const isHashActiveDay = $page.url.hash === menuDay.href}
      {@const isScrollspyActiveDay = menuDay.locations.some((location) =>
        $activeSectionIds.has(location.id),
      )}

      <Collapsible.Root open={true} class="group/collapsible">
        {#snippet child({ props }: { props: HTMLAttributes<HTMLElement> })}
          <Sidebar.MenuItem {...props}>
            <Sidebar.MenuButton
              isHashActive={isHashActiveDay}
              isScrollspyActive={isScrollspyActiveDay}
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
                  {@const isHashActiveLocation = $page.url.hash === menuLocation.href}
                  {@const isScrollspyActiveLocation = $activeSectionIds.has(menuLocation.id)}
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

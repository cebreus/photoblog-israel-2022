<script lang="ts">
  import Calendar from "@lucide/svelte/icons/calendar";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { Collapsible } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  import * as Sidebar from "$lib/components/ui/sidebar";
  import { i18n, languageTag } from "$lib/i18n";
  import * as m from "$lib/paraglide/messages";
  import { filters } from "$lib/stores/filters.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { MenuManifest } from "$lib/types/manifest";
  import { formatDateForDisplay, formatWeekday } from "$lib/utils/strings";

  import { page } from "$app/state";

  let { menuItems = [] }: { menuItems: MenuManifest } = $props();

  // Helper to localize anchor links (e.g. /#day-1 -> /en#day-1)
  function localizeHref(href: string) {
    if (href.startsWith("/#")) {
      const hash = href.substring(1); // Keep #
      // Resolve path for root "/" in current language, then append hash
      return i18n.resolveRoute(i18n.route("/"), languageTag()) + hash;
    }
    return href;
  }

  // Filter menu items to only show days and locations that are currently visible
  // This prevents dead links in the sidebar and fixes build errors during prerendering
  let visibleMenuDays = $derived.by(() => {
    // 1. Gather all currently visible item IDs (images, separators, etc.)
    const visibleItemIds = new Set<string>();
    const visibleDayIds = new Set<string>();

    for (const day of filters.filteredPhotoDays) {
      if (day.date) visibleDayIds.add(`day-${day.date}`);
      if (day.id) visibleDayIds.add(day.id);

      for (const item of day.items) {
        visibleItemIds.add(item.id);
      }
    }

    // 2. Filter the menu manifest
    return menuItems
      .filter((menuDay) => visibleDayIds.has(menuDay.id))
      .map((menuDay) => ({
        ...menuDay,
        href: localizeHref(menuDay.href),
        locations: menuDay.locations
          .filter((loc) => {
            const targetId = loc.href.split("#")[1]; // extract "loc-..." or "image-id..."
            return targetId && visibleItemIds.has(targetId);
          })
          .map((loc) => ({
            ...loc,
            href: localizeHref(loc.href),
          })),
      }));
  });

  // Helper function to check if a day is scrollspy active
  function isDayScrollspyActive(dayId: string, locationIds: string[]): boolean {
    return ui.activeSections.has(dayId) || locationIds.some((id) => ui.activeSections.has(id));
  }
</script>

<Sidebar.Menu data-testid="agenda-tab" class="px-2">
  <Sidebar.Group>
    {#each visibleMenuDays as menuDay (menuDay.id)}
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
                <div class="flex w-full items-center" {...props}>
                  <a href={menuDay.href} class="flex grow items-center gap-2">
                    <Calendar class="size-4" />
                    <span class="capitalize"
                      >{formatWeekday(menuDay.date)} {formatDateForDisplay(menuDay.date)}</span
                    >
                  </a>
                  <Collapsible.Trigger
                    class="ml-auto"
                    aria-label="{m.sidebar_expand_day()} {menuDay.date}"
                  >
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
                      startDate={menuLocation.startDate}
                      endDate={menuLocation.endDate}
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

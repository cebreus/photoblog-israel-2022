<script lang="ts">
  import Calendar from "@lucide/svelte/icons/calendar";
  import Pencil from "@lucide/svelte/icons/pencil";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import User from "@lucide/svelte/icons/user";
  import type { ComponentProps } from "svelte";
  import { untrack } from "svelte";

  import AgendaTab from "$lib/components/sidebar-content/AgendaTab.svelte";
  import EditTab from "$lib/components/sidebar-content/EditTab.svelte";
  import FiltersTab from "$lib/components/sidebar-content/FiltersTab.svelte";
  import PeopleTab from "$lib/components/sidebar-content/PeopleTab.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import * as Tabs from "$lib/components/ui/tabs";
  import { editor } from "$lib/stores/editor.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { MenuManifest, PhotoDay } from "$lib/types/manifest";

  import { dev } from "$app/environment";
  import { page } from "$app/state";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  // Combine Sidebar.Root props with our custom props
  let {
    menuItems = [],
    authors = [],
    qualityStats = new Map(),
    mediaStats = new Map(),
    snapshotStats = { total: 0, author: 0, others: 0 },
    ref = $bindable(null),
    collapsible = "offcanvas",
    side = "right",
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & {
    menuItems: MenuManifest;
    authors: AuthorStats[];
    qualityStats?: Map<string, number>;
    mediaStats?: Map<string, number>;
    snapshotStats?: { total: number; author: number; others: number };
  } = $props();

  // Derive items for EditTab
  const items = $derived((page.data.photoDays as PhotoDay[])?.flatMap((day) => day.items) ?? []);

  // Auto-switch to edit tab and open sidebar if selection/edit mode active
  $effect(() => {
    if (editor.selection.size > 0) {
      ui.activeTab = "edit";
      ui.sidebarOpen = true;
    }
  });

  const sidebar = Sidebar.useSidebar();

  $effect(() => {
    // When store changes -> update sidebar
    // We untrack sidebar.open to ensure this only runs when ui.sidebarOpen changes
    const targetState = ui.sidebarOpen;
    untrack(() => {
      if (targetState !== sidebar.open) {
        sidebar.setOpen(targetState);
      }
    });
  });

  $effect(() => {
    // When sidebar changes (e.g. trigger click) -> update store
    // We untrack ui.sidebarOpen to ensure this only runs when sidebar.open changes
    const currentState = sidebar.open;
    untrack(() => {
      if (currentState !== ui.sidebarOpen) {
        ui.sidebarOpen = currentState;
      }
    });
  });
</script>

<Sidebar.Root bind:ref {collapsible} {side} {...restProps} data-testid="app-sidebar">
  <Tabs.Root
    value={ui.activeTab}
    onValueChange={(v) => {
      ui.activeTab = v;
      if (v === "edit") {
        editor.setEditMode(true);
      }
    }}
    class="flex h-full w-full flex-col"
  >
    <Sidebar.Header class="p-0">
      <div class="border-sidebar-border flex h-14 flex-row items-center border-b px-4">
        <Tabs.List class="w-full bg-transparent p-0">
          <Tabs.Trigger
            value="agenda"
            class="data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground flex-1 gap-2"
            data-testid="app-sidebar-agenda-tab"
          >
            <Calendar class="size-4" />
            <span class="sr-only sm:not-sr-only">Agenda</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="filters"
            class="data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground flex-1 gap-2"
            data-testid="app-sidebar-filters-tab"
          >
            <SlidersHorizontal class="size-4" />
            <span class="sr-only sm:not-sr-only">Filtry</span>
          </Tabs.Trigger>
          {#if dev}
            <Tabs.Trigger
              value="people"
              class="data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground flex-1 gap-2"
              data-testid="app-sidebar-people-tab"
            >
              <User class="size-4" />
              <span class="sr-only sm:not-sr-only">Lidé</span>
            </Tabs.Trigger>
          {/if}
          {#if dev}
            <Tabs.Trigger
              value="edit"
              class="data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground flex-1 gap-2"
              data-testid="app-sidebar-edit-tab"
            >
              <Pencil class="size-4" />
              <span class="sr-only">Editace</span>
            </Tabs.Trigger>
          {/if}
        </Tabs.List>
      </div>
    </Sidebar.Header>

    <Tabs.Content value="agenda" class="mt-0 flex h-full flex-col overflow-hidden">
      <Sidebar.Content>
        <AgendaTab {menuItems} />
      </Sidebar.Content>
    </Tabs.Content>
    <Tabs.Content value="filters" class="mt-0 flex h-full flex-col overflow-hidden">
      <FiltersTab {authors} {qualityStats} {mediaStats} {snapshotStats} />
    </Tabs.Content>
    {#if dev}
      <Tabs.Content value="people" class="mt-0 flex h-full flex-col overflow-hidden">
        {#if ui.activeTab === "people"}
          <PeopleTab />
        {/if}
      </Tabs.Content>
    {/if}
    {#if dev}
      <Tabs.Content value="edit" class="mt-0 flex h-full flex-col overflow-hidden">
        <Sidebar.Content>
          <EditTab {items} />
        </Sidebar.Content>
      </Tabs.Content>
    {/if}
  </Tabs.Root>
  <Sidebar.Rail />
</Sidebar.Root>

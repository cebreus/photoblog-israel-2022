<script lang="ts">
import * as Sidebar from "$lib/components/ui/sidebar";
import * as Tabs from "$lib/components/ui/tabs";
import { untrack } from "svelte";
import AgendaTab from "$lib/components/sidebar-content/AgendaTab.svelte";
import FiltersTab from "$lib/components/sidebar-content/FiltersTab.svelte";
import EditTab from "$lib/components/sidebar-content/EditTab.svelte";
import type { MenuManifest, PhotoDay } from "$lib/types/manifest";
import { page } from "$app/stores";
import { selection, editMode } from "$lib/stores/editorState";
import { Calendar, SlidersHorizontal, Pencil } from "lucide-svelte";
import type { ComponentProps } from "svelte";
import { activeTab, isSidebarOpen } from "$lib/stores/uiState";
import { dev } from "$app/environment";

type AuthorStats = {
  name: string;
  count: number;
  slug?: string;
};

// Combine Sidebar.Root props with our custom props
let {
  menuItems = [],
  authors = [],
  ref = $bindable(null),
  collapsible = "offcanvas",
  side = "right",
  ...restProps
}: ComponentProps<typeof Sidebar.Root> & {
  menuItems: MenuManifest;
  authors: AuthorStats[];
} = $props();

// Derive items for EditTab
const items = $derived(($page.data.photoDays as PhotoDay[])?.flatMap((day) => day.items) ?? []);

// Auto-switch to edit tab and open sidebar if selection/edit mode active
$effect(() => {
  if ($selection.size > 0) {
    $activeTab = "edit";
    $isSidebarOpen = true;
  }
});

const sidebar = Sidebar.useSidebar();

$effect(() => {
  // When store changes -> update sidebar
  // We untrack sidebar.open to ensure this only runs when $isSidebarOpen changes
  const targetState = $isSidebarOpen;
  untrack(() => {
    if (targetState !== sidebar.open) {
      sidebar.setOpen(targetState);
    }
  });
});

$effect(() => {
  // When sidebar changes (e.g. trigger click) -> update store
  // We untrack $isSidebarOpen to ensure this only runs when sidebar.open changes
  const currentState = sidebar.open;
  untrack(() => {
    if (currentState !== $isSidebarOpen) {
      $isSidebarOpen = currentState;
    }
  });
});
</script>

<Sidebar.Root
  bind:ref
  {collapsible}
  {side}
  {...restProps}
  data-testid="app-sidebar"
>
  <Tabs.Root
    value={$activeTab}
    onValueChange={(v) => {
      $activeTab = v;
      if (v === "edit") {
        editMode.enable();
      } else {
        editMode.disable();
      }
    }}
    class="flex flex-col h-full w-full"
  >
    <Sidebar.Header class="p-0">
      <div
        class="h-14 flex flex-row items-center px-4 border-b border-sidebar-border"
      >
        <Tabs.List class="w-full bg-transparent p-0">
          <Tabs.Trigger
            value="agenda"
            class="flex-1 gap-2 data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground"
            data-testid="app-sidebar-agenda-tab"
          >
            <Calendar class="size-4" />
            <span class="sr-only sm:not-sr-only">Agenda</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="filters"
            class="flex-1 gap-2 data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground"
            data-testid="app-sidebar-filters-tab"
          >
            <SlidersHorizontal class="size-4" />
            <span class="sr-only sm:not-sr-only">Filtry</span>
          </Tabs.Trigger>
          {#if dev}
            <Tabs.Trigger
              value="edit"
              class="flex-1 gap-2 data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground"
              data-testid="app-sidebar-edit-tab"
            >
              <Pencil class="size-4" />
              <span class="sr-only sm:not-sr-only">Editace</span>
            </Tabs.Trigger>
          {/if}
        </Tabs.List>
      </div>
    </Sidebar.Header>

    <Tabs.Content
      value="agenda"
      class="mt-0 h-full flex flex-col overflow-hidden"
    >
      <Sidebar.Content>
        <AgendaTab {menuItems} />
      </Sidebar.Content>
    </Tabs.Content>
    <Tabs.Content
      value="filters"
      class="mt-0 h-full flex flex-col overflow-hidden"
    >
      <FiltersTab {authors} />
    </Tabs.Content>
    {#if dev}
      <Tabs.Content
        value="edit"
        class="mt-0 h-full flex flex-col overflow-hidden"
      >
        <Sidebar.Content>
          <EditTab {items} />
        </Sidebar.Content>
      </Tabs.Content>
    {/if}
  </Tabs.Root>
  <Sidebar.Rail />
</Sidebar.Root>

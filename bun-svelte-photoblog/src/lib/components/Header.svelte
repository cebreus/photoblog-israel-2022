<script lang="ts">
  import { page } from "$app/stores";
  import type { MenuManifest, PhotoDay } from "$lib/types/manifest";
  import AgendaOffcanvas from "$lib/components/header/AgendaOffcanvas.svelte";
  import FiltersOffcanvas from "$lib/components/header/FiltersOffcanvas.svelte";
  import EditOffcanvas from "$lib/components/header/EditOffcanvas.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Bug } from "lucide-svelte";
  import { debug } from "$lib/stores/debug";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let {
    menuItems = [],
    authors = [],
  }: { menuItems?: MenuManifest; authors?: AuthorStats[] } = $props();

  const siteManifest = $derived($page.data.siteManifest);
  const items = $derived(
    ($page.data.photoDays as PhotoDay[])?.flatMap((day) => day.items) ?? [],
  );
</script>

<header
  class="sticky top-0 border-b bg-slate-800 text-slate-100 z-10 border-slate-700"
>
  <div class="container mx-auto py-2.5 flex items-center gap-4">
    <div class="flex-1 flex items-center gap-8">
      <a href="/" class="text-lg font-semibold uppercase"
        >{siteManifest?.open_graph?.site_name}</a
      >
    </div>

    {#if import.meta.env.DEV}
      <Button
        variant="ghost"
        size="icon"
        onclick={() => debug.update((v: boolean) => !v)}
        title="Přepnout režim ladění"
        aria-label="Přepnout režim ladění"
        data-testid="debug-trigger"
      >
        <Bug strokeWidth={2.5} />
      </Button>
      <EditOffcanvas {items} />
    {/if}
    <FiltersOffcanvas {authors} />
    <AgendaOffcanvas {menuItems} />
  </div>
</header>

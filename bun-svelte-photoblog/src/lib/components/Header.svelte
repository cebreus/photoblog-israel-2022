<script lang="ts">
  import { page } from "$app/stores";
  import type { MenuManifest, PhotoDay } from "$lib/types/manifest";
  import { Button } from "$lib/components/ui/button";
  import { Bug } from "lucide-svelte";
  import { debug } from "$lib/stores/debug";
  import * as Sidebar from "$lib/components/ui/sidebar";

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
</script>

<header
  class="sticky h-14 top-0 border-b bg-slate-800 text-slate-100 z-10 border-slate-700 flex flex-row items-center px-6"
>
  <a href="/" class="text-lg font-semibold uppercase mr-auto">
    {siteManifest?.open_graph?.site_name}
  </a>

  {#if import.meta.env.DEV}
    <Button
      variant="ghost"
      size="icon"
      onclick={() => debug.update((v: boolean) => !v)}
      title="Přepnout režim ladění"
      data-testid="debug-trigger"
    >
      <Bug strokeWidth={2.5} />
    </Button>
  {/if}

  <Sidebar.Trigger class="-me-1 rotate-180" />
</header>

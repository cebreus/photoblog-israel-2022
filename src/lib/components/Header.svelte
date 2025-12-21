<script lang="ts">
  import Bug from "lucide-svelte/icons/bug";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import Tags from "lucide-svelte/icons/tags";

  import { Button } from "$lib/components/ui/button";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { editor } from "$lib/stores/editor.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { MenuManifest } from "$lib/types/manifest";

  import { dev } from "$app/environment";
  import { page } from "$app/stores";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let { menuItems = [], authors = [] }: { menuItems?: MenuManifest; authors?: AuthorStats[] } =
    $props();

  const siteManifest = $derived($page.data.siteManifest);
</script>

<header
  class="sticky top-0 z-10 flex h-14 flex-row items-center gap-2 border-b border-slate-700 bg-slate-800 px-6 text-slate-100"
  data-testid="header"
>
  <a href="/" class="mr-auto text-lg font-semibold uppercase" data-testid="header-logo">
    {siteManifest?.open_graph?.site_name}
  </a>

  {#if dev}
    <Button
      variant={editor.showMetadataOverlay ? "secondary" : "ghost"}
      size="icon"
      onclick={() => editor.setShowMetadataOverlay(!editor.showMetadataOverlay)}
      aria-label="Zobrazit/skrýt popisky fotek"
      data-testid="header-metadata-overlay-trigger"
    >
      <Tags strokeWidth={2.5} />
    </Button>

    <Button
      variant={ui.curationMode ? "secondary" : "ghost"}
      size="icon"
      onclick={() => ui.setCurationMode(!ui.curationMode)}
      aria-label="Režim kurátora"
      data-testid="header-curation-trigger"
    >
      <Sparkles strokeWidth={2.5} />
    </Button>

    <Button
      variant={ui.debug ? "secondary" : "ghost"}
      size="icon"
      onclick={() => ui.setDebug(!ui.debug)}
      aria-label="Přepnout režim ladění"
      data-testid="header-debug-trigger"
    >
      <Bug strokeWidth={2.5} />
    </Button>
  {/if}

  <Sidebar.Trigger class="-me-1 rotate-180" data-testid="header-sidebar-trigger" />
</header>

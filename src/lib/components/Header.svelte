<script lang="ts">
  import Bug from "@lucide/svelte/icons/bug";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Tags from "@lucide/svelte/icons/tags";

  import LanguageSwitcher from "$lib/components/LanguageSwitcher.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { i18n, languageTag } from "$lib/i18n";
  import * as m from "$lib/paraglide/messages";
  import { editor } from "$lib/stores/editor.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import type { MenuManifest } from "$lib/types/manifest";

  import { dev } from "$app/environment";
  import { page } from "$app/state";

  type AuthorStats = {
    name: string;
    count: number;
    slug?: string;
  };

  let { menuItems = [], authors = [] }: { menuItems?: MenuManifest; authors?: AuthorStats[] } =
    $props();

  const siteManifest = $derived(page.data.siteManifest);
</script>

<header
  class="sticky top-0 z-10 flex h-14 flex-row items-center gap-2 border-b border-slate-700 bg-slate-800 px-6 text-slate-100"
  data-testid="header"
>
  <div class="mr-auto flex items-center gap-3">
    <a
      href={i18n.resolveRoute("/", languageTag())}
      class="text-lg font-semibold uppercase"
      data-testid="header-logo"
    >
      {siteManifest?.open_graph?.site_name}
    </a>
    <LanguageSwitcher />
  </div>

  {#if dev}
    <Button
      variant={editor.editMode ? "destructive" : "secondary"}
      class="mr-3"
      size="icon"
      onclick={() => editor.toggleEditMode()}
      aria-label={editor.editMode ? m.header_edit_off() : m.header_edit_on()}
      title={editor.editMode ? m.header_edit_off() : m.header_edit_on()}
      data-testid="header-edit-trigger"
    >
      <Pencil strokeWidth={2.5} />
    </Button>

    {#if editor.editMode}
      <Button
        variant={editor.reorderMode ? "default" : "ghost"}
        size="icon"
        onclick={() => editor.toggleReorderMode()}
        aria-label={editor.reorderMode ? m.header_reorder_off() : m.header_reorder_on()}
        title={editor.reorderMode ? m.header_reorder_off() : m.header_reorder_on()}
        data-testid="header-reorder-trigger"
      >
        <GripVertical strokeWidth={2.5} />
      </Button>
    {/if}

    <Button
      variant={editor.showMetadataOverlay ? "default" : "ghost"}
      size="icon"
      onclick={() => editor.setShowMetadataOverlay(!editor.showMetadataOverlay)}
      aria-label={m.header_metadata_overlay()}
      data-testid="header-metadata-overlay-trigger"
    >
      <Tags strokeWidth={2.5} />
    </Button>

    <Button
      variant={ui.debugMode ? "default" : "ghost"}
      size="icon"
      onclick={() => ui.setDebugMode(!ui.debugMode)}
      aria-label={m.header_debug_mode()}
      data-testid="header-debug-trigger"
    >
      <Bug strokeWidth={2.5} />
    </Button>

    <Button
      variant={ui.curationMode ? "default" : "ghost"}
      size="icon"
      onclick={() => ui.setCurationMode(!ui.curationMode)}
      aria-label={m.header_curation_mode()}
      data-testid="header-curation-trigger"
    >
      <Sparkles strokeWidth={2.5} />
    </Button>
  {/if}

  <Sidebar.Trigger class="-me-1 rotate-180" data-testid="header-sidebar-trigger" />
</header>

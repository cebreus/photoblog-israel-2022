<script lang="ts">
  import type { MenuManifest } from "$lib/types/manifest";
  import AgendaOffcanvas from "$lib/components/header/AgendaOffcanvas.svelte";
  import FiltersOffcanvas from "$lib/components/header/FiltersOffcanvas.svelte";

  type AuthorStats = {
    name: string;
    count: number;
  };

  export let menuItems: MenuManifest = [];
  export let authors: AuthorStats[] = [];
</script>

<header
  class="sticky top-0 border-b bg-slate-800 text-slate-100 z-10 border-slate-700"
>
  <div class="container mx-auto py-2.5 flex items-center gap-4">
    <div class="flex-1 flex items-center gap-8">
      <a href="/" class="text-lg font-semibold uppercase">Izrael 2022</a>
    </div>

    <FiltersOffcanvas {authors} />
    <AgendaOffcanvas {menuItems} />
  </div>
</header>

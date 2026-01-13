<script lang="ts">
  import { Search } from "@lucide/svelte";

  import GalleryEmptyState from "$lib/components/GalleryEmptyState.svelte";
  import * as m from "$lib/paraglide/messages";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>{page.status} — {m.error_not_found_title()}</title>
</svelte:head>

<div class="flex flex-1 items-center justify-center p-6">
  <GalleryEmptyState
    title={page.status === 404 ? m.error_not_found_title() : `Chyba ${page.status}`}
    description={page.status === 404
      ? m.error_not_found_description()
      : (page.error?.message ?? "")}
    icon={Search}
    action={{
      label: m.error_go_home(),
      handler: () => goto("/"),
    }}
  />
</div>

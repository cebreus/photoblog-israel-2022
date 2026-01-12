<script lang="ts">
  import { Search } from "@lucide/svelte";

  import GalleryEmptyState from "$lib/components/GalleryEmptyState.svelte";
  import { ERROR_MESSAGES } from "$lib/utils/messages";

  import { goto } from "$app/navigation";
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>{page.status} — {ERROR_MESSAGES.NOT_FOUND_TITLE}</title>
</svelte:head>

<div class="flex flex-1 items-center justify-center p-6">
  <GalleryEmptyState
    title={page.status === 404 ? ERROR_MESSAGES.NOT_FOUND_TITLE : `Chyba ${page.status}`}
    description={page.status === 404
      ? ERROR_MESSAGES.NOT_FOUND_DESCRIPTION
      : (page.error?.message ?? "")}
    icon={Search}
    action={{
      label: ERROR_MESSAGES.GO_HOME,
      handler: () => goto("/"),
    }}
  />
</div>

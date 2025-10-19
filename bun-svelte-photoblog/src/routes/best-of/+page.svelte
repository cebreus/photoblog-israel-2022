<script lang="ts">
  import PhotoGrid from '$lib/components/PhotoGrid.svelte';
  import type { ContentItem } from '$lib/content';

  /** @type {import('./$types').PageData} */
  export let data;
</script>

<PhotoGrid items={data.content.filter((item: ContentItem) => !item.isIntro)} />

<script lang="ts">
  import Intro from '$lib/components/Intro.svelte';
  import PhotoGrid from '$lib/components/PhotoGrid.svelte';
  import type { ContentItem } from '$lib/content';

  /** @type {import('./$types').PageData} */
  export let data;

  const introData = data.content.find((item: ContentItem) => item.isIntro);
</script>

{#if introData}
  <Intro item={introData} />
{/if}

<PhotoGrid items={data.content.filter((item: ContentItem) => !item.isIntro)} />

<script lang="ts">
  import type { ContentItem } from '$lib/content';
  import PhotoItem from './PhotoItem.svelte';

  export let items: ContentItem[];
</script>

<section class="py-8 px-4"> <!-- Replaced .section with py-8 px-4 -->
  <div class="max-w-7xl mx-auto"> <!-- Replaced .section__content with max-w-7xl mx-auto -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> <!-- Replaced .photoblog-grid -->
      {#each items as item (item.id)}
        <PhotoItem {item} />
      {/each}
    </div>
  </div>
</section>
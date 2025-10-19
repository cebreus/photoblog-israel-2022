<script lang="ts">
  import type { ContentItem } from '$lib/content';

  export let item: ContentItem;
</script>

<section class="min-h-[80vh] flex items-center justify-center text-center bg-gray-900 text-white">
  <div class="w-full max-w-4xl mx-auto px-4"> <!-- Adjusted max-w and added px -->
    <div> <!-- Removed .intro class, applied directly -->
      <h1 class="text-5xl font-black mb-4">{item.title}</h1>
      <p class="text-xl max-w-2xl mx-auto mb-8">{@html item.content}</p>
      <div class="mt-8"> <!-- Removed .intro__scroll-down, applied directly -->
        <a href="#photoblog-grid-start" class="text-white hover:text-orange-500 font-semibold">Přejít na obsah</a>
      </div>
    </div>
  </div>
</section>
<div id="photoblog-grid-start"></div>
<script lang="ts">
  import { buildSrcSet, pickFallback } from '$lib/images';
  import type { ContentItem } from '$lib/content';

  export let item: ContentItem;

  const sources = [
    { type: 'image/avif', srcset: buildSrcSet(item, 'avif') },
    { type: 'image/webp', srcset: buildSrcSet(item, 'webp') },
  ].filter((s) => s.srcset);

  const fallback = pickFallback(item);

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);
  }
</script>

<article class="bg-white rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105">
  <div> <!-- Removed .photoblog-item -->
    <figure class="m-0"> <!-- Removed .photoblog-item__figure -->
      {#if fallback}
        <picture>
          {#each sources as source}
            <source srcset={source.srcset} type={source.type} sizes="(min-width: 1024px) 33vw, 100vw" />
          {/each}
          <img src={fallback.src} alt={item.title} loading="lazy" class="w-full h-auto object-cover" width={item.original.width} height={item.original.height} /> <!-- Removed .photoblog-item__img -->
        </picture>
      {/if}
      <figcaption class="p-6"> <!-- Removed .photoblog-item__caption -->
        <div class="mb-4 max-w-none"> <!-- Removed .photoblog-item__caption-content -->
          {@html item.content}
        </div>
        <div class="text-sm text-gray-500 flex justify-between border-t pt-4 mt-4"> <!-- Removed .photoblog-item__meta -->
          <time datetime={item.date}>{formatDate(item.date)}</time>
          <span>{item.title}</span>
        </div>
      </figcaption>
    </figure>
  </div>
</article>
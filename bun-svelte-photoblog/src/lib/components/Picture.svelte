<script lang="ts">
  import {
    findImage,
    getSources,
    getImgFallback,
    placeholderBackgroundStyle,
    dominantColorStyle,
    type ManifestEntry,
  } from '$lib/images';

  type Props = {
    srcKey: string;
    alt: string;
    sizes?: string;
    loading?: 'eager' | 'lazy';
    decoding?: 'async' | 'sync' | 'auto';
    style?: string;
    priority?: boolean;
    placeholder?: 'none' | 'background' | 'blur';
    class?: string;
  };

  let {
    srcKey,
    alt,
    sizes = '100vw',
    loading = 'lazy',
    decoding = 'async',
    style = '',
    priority = false,
    placeholder = 'background',
    class: className = '',
  }: Props = $props();

  let loaded = $state(false);

  // Derived values instead of $effect
  let entry = $derived(findImage(srcKey));
  let imgOptions = $derived(entry ? getImgFallback(entry, sizes) : null);
  let sources = $derived(entry ? getSources(entry, sizes) : []);
  let fetchpriority: 'auto' | 'high' | 'low' | undefined = $derived(
    priority ? 'high' : undefined,
  );
  let imgLoading = $derived(priority ? 'eager' : loading);

  function handleLoad() {
    loaded = true;
  }

  // Inline styles for placeholder/color background mode
  let placeholderStyle = $derived(
    placeholder === 'background' && entry
      ? [dominantColorStyle(entry), placeholderBackgroundStyle(entry)]
          .filter(Boolean)
          .join('')
      : dominantColorStyle(entry) || '',
  );

  // For blur mode we render an extra absolutely-positioned LQIP img
  let lqipUrl = $derived(
    entry?.placeholder?.base64 && entry?.placeholder?.type
      ? `data:${entry.placeholder.type};base64,${entry.placeholder.base64}`
      : undefined,
  );
</script>

{#if !entry}
  <!-- Fallback if manifest key is missing -->
  <img {alt} class={className} {style} loading={imgLoading} {decoding} />
{:else}
  <div
    class={`pb-picture ${loaded ? 'is-loaded' : ''} ${className}`}
    style={`${placeholderStyle}${style}`}
  >
    {#if placeholder === 'blur' && lqipUrl}
      <img aria-hidden="true" alt="" class="pb-picture__lqip" src={lqipUrl} />
    {/if}

    <picture>
      {#each sources as s (s.type)}
        <source type={s.type} srcset={s.srcset} sizes={s.sizes} />
      {/each}
      {#if imgOptions}
        <img
          src={imgOptions.src}
          srcset={imgOptions.srcset}
          sizes={imgOptions.sizes}
          {alt}
          loading={imgLoading}
          {decoding}
          {fetchpriority}
          class="pb-picture__img"
          onload={handleLoad}
        />
      {:else}
        <!-- Worst-case if no variants exist -->
        <img
          src={(entry.original && entry.original.path) || ''}
          {alt}
          loading={imgLoading}
          {decoding}
          {fetchpriority}
          class="pb-picture__img"
          onload={handleLoad}
        />
      {/if}
    </picture>
  </div>
{/if}

<style>
  .pb-picture {
    position: relative;
    display: block;
    overflow: hidden;
    /* Background placeholder/color is applied inline via style */
    transition:
      background-image 200ms ease-out,
      background-color 200ms ease-out;
  }

  .pb-picture__img {
    display: block;
    width: 100%;
    height: auto;
  }

  /* Blur LQIP layer */
  .pb-picture__lqip {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px);
    transform: scale(1.05);
    transition: opacity 250ms ease-out;
    opacity: 1;
    pointer-events: none;
  }

  .pb-picture.is-loaded .pb-picture__lqip {
    opacity: 0;
  }
</style>

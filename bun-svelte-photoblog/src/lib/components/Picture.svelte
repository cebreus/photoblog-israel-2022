<script lang="ts">
  import {
    findImage,
    getSources,
    getImgFallback,
    placeholderBackgroundStyle,
    dominantColorStyle,
    type ManifestEntry,
  } from '$lib/images';

  export let srcKey: string;
  export let alt: string;
  export let sizes: string = '100vw';
  export let loading: 'eager' | 'lazy' = 'lazy';
  export let decoding: 'async' | 'sync' | 'auto' = 'async';
  export let style: string = '';
  export let priority: boolean = false;
  export let placeholder: 'none' | 'background' | 'blur' = 'background';

  let entry: ManifestEntry | undefined;
  let loaded = false;

  // Explicit typing to satisfy Svelte TS for attributes
  let fetchpriority: 'auto' | 'high' | 'low' | null | undefined = undefined;
  let imgLoading: 'eager' | 'lazy' = 'lazy';

  $: entry = findImage(srcKey);
  $: imgOptions = entry ? getImgFallback(entry, sizes) : null;
  $: sources = entry ? getSources(entry, sizes) : [];
  $: fetchpriority = priority ? 'high' : undefined;
  $: imgLoading = priority ? 'eager' : loading;

  function handleLoad() {
    loaded = true;
  }

  // Inline styles for placeholder/color background mode
  $: placeholderStyle =
    placeholder === 'background' && entry
      ? [dominantColorStyle(entry), placeholderBackgroundStyle(entry)]
          .filter(Boolean)
          .join('')
      : dominantColorStyle(entry) || '';

  // For blur mode we render an extra absolutely-positioned LQIP img
  $: lqipUrl =
    entry?.placeholder?.base64 && entry?.placeholder?.type
      ? `data:${entry.placeholder.type};base64,${entry.placeholder.base64}`
      : undefined;
</script>

{#if !entry}
  <!-- Fallback if manifest key is missing -->
  <img
    {alt}
    class={$$props.class}
    style={$$props.style}
    loading={imgLoading}
    {decoding}
  />
{:else}
  <div
    class={`pb-picture ${loaded ? 'is-loaded' : ''} ${$$props.class ?? ''}`}
    style={`${placeholderStyle}${$$props.style ?? ''}`}
  >
    {#if placeholder === 'blur' && lqipUrl}
      <img aria-hidden="true" alt="" class="pb-picture__lqip" src={lqipUrl} />
    {/if}

    <picture>
      {#each sources as s}
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
          on:load={handleLoad}
        />
      {:else}
        <!-- Worst-case if no variants exist -->
        <img
          src={entry.original.path || ''}
          {alt}
          loading={imgLoading}
          {decoding}
          {fetchpriority}
          class="pb-picture__img"
          on:load={handleLoad}
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

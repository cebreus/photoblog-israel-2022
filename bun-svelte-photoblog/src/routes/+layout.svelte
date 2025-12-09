<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import faviconHtml from "../../.temp/favicons.html?raw";
  import "../app.css";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { showPhotoLabels } from "$lib/stores/photoLabels";
  import { debug } from "$lib/stores/debug";
  import type { Author, MenuManifest, SiteManifest } from "$lib/types/manifest";
  import { initUrlSync } from "$lib/stores/url-sync";

  // Explicitly type props instead of relying on loose inferred types
  interface Props {
    data: {
      authors: Author[];
      menuItems: MenuManifest;
      siteManifest: SiteManifest;
    };
    children?: import("svelte").Snippet;
  }

  let { data, children }: Props = $props();

  // Initialize all URL-related synchronization logic
  $effect(() => {
    if (browser) {
      initUrlSync(data.authors);
    }
  });

  // Initialize debug store from URL
  $effect(() => debug.initializeFromUrl($page.url));
  // Handle body class for photo labels visibility
  $effect(() => {
    if (browser) {
      document.body.classList.toggle("show-labels", $showPhotoLabels);
    }
  });
</script>

<svelte:head>
  {@html faviconHtml}
  {#if data.siteManifest?.seo}
    <title>{data.siteManifest.seo.title}</title>
    {#if data.siteManifest.seo.description}
      <meta name="description" content={data.siteManifest.seo.description} />
    {/if}
    {#if data.siteManifest.seo.robots}
      <meta name="robots" content={data.siteManifest.seo.robots} />
    {/if}
  {/if}

  {#if data.siteManifest?.open_graph?.use}
    <meta
      property="og:site_name"
      content={data.siteManifest.open_graph.site_name}
    />
    <meta property="og:type" content={data.siteManifest.open_graph.type} />
    {#if data.siteManifest.open_graph.image}
      {#each data.siteManifest.open_graph.image as img}
        <meta property="og:image" content={img} />
      {/each}
    {/if}
  {/if}
</svelte:head>

<Header menuItems={data.menuItems} authors={data.authors} />

{@render children?.()}

<Footer />

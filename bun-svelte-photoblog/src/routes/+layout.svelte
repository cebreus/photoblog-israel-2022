<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import faviconHtml from "../../.temp/favicons.html?raw";
  import "../app.css";
  import { ModeWatcher } from "mode-watcher";
  import { browser } from "$app/environment";
  import { showPhotoLabels } from "$lib/stores/photoLabels";
  import type { Author, MenuManifest, SiteManifest } from "$lib/types/manifest";
  import { initUrlSync } from "$lib/stores/urlSync";
  import { Toaster } from "$lib/components/ui/sonner";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import AppSidebar from "$lib/components/AppSidebar.svelte";

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

<ModeWatcher />

<Sidebar.Provider style="--sidebar-width: 24rem;">
  <Sidebar.Inset>
    <div class="flex flex-col min-h-screen">
      <Header menuItems={data.menuItems} authors={data.authors} />

      <main class="flex flex-1 flex-col">
        {@render children?.()}
      </main>

      <Footer />
    </div>
  </Sidebar.Inset>
  <AppSidebar menuItems={data.menuItems} authors={data.authors} side="right" />
</Sidebar.Provider>

<Toaster position="top-right" />

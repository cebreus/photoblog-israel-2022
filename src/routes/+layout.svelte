<script lang="ts">
  import { ParaglideJS } from "@inlang/paraglide-js-adapter-sveltekit";
  import { QueryClient } from "@tanstack/query-core";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import { ModeWatcher } from "mode-watcher";

  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import Header from "$lib/components/Header.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Toaster } from "$lib/components/ui/sonner";
  import { i18n } from "$lib/i18n";
  import * as m from "$lib/paraglide/messages";
  import { manifest } from "$lib/stores/manifest.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import { initUrlSync } from "$lib/stores/urlSync.svelte";
  import type {
    Author,
    CurationManifest,
    MenuManifest,
    PeopleManifest,
    PhotoDay,
    SiteManifest,
  } from "$lib/types/manifest";

  import { browser, dev } from "$app/environment";

  import faviconHtml from "../../.temp/favicons.html?raw";
  import "../app.css";

  // Explicitly type props instead of relying on loose inferred types
  interface Props {
    data: {
      authors: Author[];
      menuItems: MenuManifest;
      siteManifest: SiteManifest;
      curationManifest?: CurationManifest;
      qualityStats: Map<string, number>;
      mediaStats: Map<string, number>;
      snapshotStats: { total: number; author: number; others: number };
      photoDays: PhotoDay[];
      peopleManifest: PeopleManifest;
    };

    children?: import("svelte").Snippet;
  }

  let { data, children }: Props = $props();

  // Initialize TanStack Query client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: browser,
        retry: 1,
        staleTime: 1000 * 30, // 30 seconds default
        refetchOnWindowFocus: false,
      },
    },
  });

  // Initialize all URL-related synchronization logic
  $effect(() => {
    if (browser) {
      initUrlSync(data.authors);
    }
  });

  // Handle body class for photo labels visibility
  $effect(() => {
    if (browser) {
      document.body.classList.toggle("show-labels", ui.photoLabels);
    }
  });

  $effect(() => {
    manifest.update(data);
  });

  $effect(() => {
    if (browser && dev) {
      document.body.classList.add("debug-screens");

      return () => document.body.classList.remove("debug-screens");
    }
  });

  const seoTitle = $derived(
    (typeof m.gallery_title === "function" ? m.gallery_title() : "") ||
      data.siteManifest?.seo?.title,
  );
  const seoDescription = $derived(
    (typeof m.gallery_description === "function" ? m.gallery_description() : "") ||
      data.siteManifest?.seo?.description,
  );
</script>

<svelte:head>
  {@html faviconHtml}

  {#if seoTitle}
    <title>{seoTitle}</title>
  {/if}

  {#if seoDescription}
    <meta name="description" content={seoDescription} />
  {/if}

  {#if data.siteManifest?.seo?.robots}
    <meta name="robots" content={data.siteManifest.seo.robots} />
  {/if}
  {#if data.siteManifest?.open_graph?.use}
    <meta property="og:site_name" content={data.siteManifest.open_graph.site_name} />
    <meta property="og:type" content={data.siteManifest.open_graph.type} />

    {#if data.siteManifest.open_graph.image}
      {#each data.siteManifest.open_graph.image as img}
        <meta property="og:image" content={img} />
      {/each}
    {/if}
  {/if}
</svelte:head>
<ModeWatcher />

<ParaglideJS {i18n}>
  <QueryClientProvider client={queryClient}>
    <Sidebar.Provider bind:open={ui.sidebarOpen} style="--sidebar-width: 24rem;">
      <Sidebar.Inset>
        <div class="flex min-h-screen flex-col">
          <Header menuItems={data.menuItems} authors={data.authors} />
          <main class="flex flex-1 flex-col" data-testid="main-content">
            {@render children?.()}
          </main>
          <Footer />
        </div>
      </Sidebar.Inset>
      <AppSidebar
        menuItems={data.menuItems}
        authors={data.authors}
        qualityStats={data.qualityStats}
        mediaStats={data.mediaStats}
        snapshotStats={data.snapshotStats}
        side="right"
      />
    </Sidebar.Provider>
    <Toaster position="top-right" richColors closeButton />
  </QueryClientProvider>
</ParaglideJS>

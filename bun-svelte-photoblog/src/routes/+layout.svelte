<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import faviconHtml from "../../.temp/favicons.html?raw";
  import "../app.css";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { showPhotoLabels } from "$lib/stores/photoLabels";
  import { debug } from "$lib/stores/debug";
  import type { Author, MenuManifest } from "$lib/types/manifest";
  import { initUrlSync } from "$lib/stores/url-sync";

  // Explicitly type props instead of relying on loose inferred types
  interface Props {
    data: {
      authors: Author[];
      menuItems: MenuManifest;
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
</svelte:head>

<Header menuItems={data.menuItems} authors={data.authors} />

{@render children?.()}

<Footer />

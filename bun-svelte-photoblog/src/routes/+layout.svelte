<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import faviconHtml from "../../.temp/favicons.html?raw";
  import "../app.css";
  import { page } from "$app/stores";
  import { debug } from "$lib/stores/debug";

  let { data, children } = $props();

  $effect(() => debug.initializeFromUrl($page.url));
</script>

<svelte:head>
  {@html faviconHtml}
</svelte:head>

<Header menuItems={data.menuItems} />

{@render children?.()}

<Footer />

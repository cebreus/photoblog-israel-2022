<script lang="ts">
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import faviconHtml from "../../.temp/favicons.html?raw";
  import "../app.css";

  let { data, children } = $props();
</script>

<svelte:head>
  {@html faviconHtml}
</svelte:head>

<Header menuItems={data.menuItems} />

{@render children?.()}

<Footer />

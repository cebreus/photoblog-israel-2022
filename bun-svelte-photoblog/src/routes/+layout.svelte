<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import favicon from '$lib/assets/favicon.svg?url';
  import '../app.css';

  let { data, children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Header menu={data.menu} />

{@render children?.()}

<Footer />

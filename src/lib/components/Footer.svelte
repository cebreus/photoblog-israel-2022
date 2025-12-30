<script>
  import { page } from "$app/state";

  const siteManifest = $derived(page.data.siteManifest);
</script>

<footer
  class="text-muted-foreground container mx-auto block border-t px-4 py-6 text-center text-sm"
  data-testid="footer"
>
  {@html siteManifest?.copyright ?? "Cebreus © 2022"}
</footer>

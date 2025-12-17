<script>
  import { page } from "$app/stores";

  const siteManifest = $derived($page.data.siteManifest);
</script>

<footer
  class="border-t container mx-auto px-4 py-6 text-center text-sm text-muted-foreground block"
  data-testid="footer"
>
  {@html siteManifest?.copyright ?? "Cebreus © 2022"}
</footer>

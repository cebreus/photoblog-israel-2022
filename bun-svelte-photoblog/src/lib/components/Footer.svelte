<script>
  import { page } from "$app/stores";
  // import { Button } from "$lib/components/ui/button";
  // import { ExternalLink } from "@lucide/svelte";

  const siteManifest = $derived($page.data.siteManifest);
</script>

<footer
  class="border-t container mx-auto px-4 py-6 text-center text-sm text-muted-foreground block"
>
  {@html siteManifest?.copyright ?? "Cebreus © 2022"}
</footer>

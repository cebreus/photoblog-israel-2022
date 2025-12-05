<script>
  import { Button } from "$lib/components/ui/button";
  import { ExternalLink } from "@lucide/svelte";
</script>

<footer
  class="border-t container mx-auto px-4 py-6 text-center text-sm text-muted-foreground flex flex-wrap items-center justify-center gap-2"
>
  <span class="whitespace-nowrap">Cebreus © 2022</span>
  <Button
    variant="link"
    href="http://creativecommons.org/licenses/by-nc/4.0/"
    target="_blank"
    rel="license noopener"
  >
    CC-BY-NC
    <ExternalLink />
  </Button>
  <Button
    variant="link"
    href="https://github.com/cebreus/photoblog-israel-2022/releases"
    target="_blank"
    rel="license noopener"
  >
    Fotky ke stažení
    <ExternalLink />
  </Button>
  <!-- <Button
    variant="link"
    href="/changelog/"
    target="_blank"
    rel="license noopener"
  >
    Change log
    <ExternalLink />
  </Button> -->
</footer>

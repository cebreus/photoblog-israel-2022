<script lang="ts">
  import { page } from "$app/stores";
  // import { ArrowRight, ArrowUpRight } from '@lucide/svelte';
  // import Badge from '$lib/components/ui/badge/badge.svelte';
  // import Button from '$lib/components/ui/button/button.svelte';

  const siteManifest = $derived($page.data.siteManifest);
</script>

<section
  class="py-24 bg-linear-to-br from-slate-700 to-slate-950"
  data-testid="hero-section"
>
  <div class="grid items-center mx-auto container gap-8 lg:grid-cols-1">
    <div
      class="flex flex-col items-center text-center gap-y-2"
      data-testid="hero-left"
    >
      <!-- <Badge variant="outline">
          ✨ Your Website Builder
          <ArrowUpRight class="ml-2 size-4" />
        </Badge> -->

      <h1
        class="my-6 text-pretty text-3xl font-bold lg:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600"
        data-testid="hero-title"
      >
        {siteManifest?.open_graph?.site_name}
      </h1>

      <p
        class="text-slate-300 mb-8 max-w-xl lg:text-lg text-balance"
        data-testid="hero-description"
      >
        {siteManifest?.manifest?.appDescription}
      </p>
    </div>

    <!-- <img
        src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
        alt="Hero section demo image showing interface components"
        class="max-h-96 w-full rounded-md object-cover"
      /> -->
  </div>
</section>

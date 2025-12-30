<script lang="ts">
  import { page } from "$app/state";

  const siteManifest = $derived(page.data.siteManifest);
</script>

<section class="bg-linear-to-br from-slate-700 to-slate-950 py-24" data-testid="hero-section">
  <div class="container mx-auto grid items-center gap-8 lg:grid-cols-1">
    <div class="flex flex-col items-center gap-y-2 text-center" data-testid="hero-left">
      <!-- <Badge variant="outline">
          ✨ Your Website Builder
          <ArrowUpRight class="ml-2 size-4" />
        </Badge> -->

      <h1
        class="my-6 bg-linear-to-br from-orange-400 to-red-600 bg-clip-text text-3xl leading-tight font-bold text-pretty text-transparent lg:text-5xl"
        data-testid="hero-title"
      >
        {siteManifest?.open_graph?.site_name}
      </h1>

      <p
        class="mb-8 max-w-xl text-balance text-slate-300 lg:text-lg"
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

<script lang="ts">
  // @ts-nocheck
  import { ArrowRight, ArrowUpRight } from '@lucide/svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';

  // hardcoded content inlined into markup below
</script>

<section class="py-24">
  <div class="container mx-auto">
    <div class="grid items-center gap-8 lg:grid-cols-2">
      <div
        class="flex flex-col items-center text-center lg:items-start lg:text-left"
      >
        <!-- <Badge variant="outline">
          ✨ Your Website Builder
          <ArrowUpRight class="ml-2 size-4" />
        </Badge> -->

        <h1 class="my-6 text-pretty text-3xl font-bold lg:text-5xl">
          Izrael 2022
        </h1>

        <p class="text-muted-foreground mb-8 max-w-xl lg:text-lg">
          Fotografické střípky z výletu do Izraele a Jordánska.
        </p>

        <!-- <div
          class="flex w-full flex-col justify-center gap-2 sm:flex-row lg:justify-start"
        >
          <Button class="w-full sm:w-auto" href="https://www.shadcnblocks.com"
            >Discover all components</Button
          >

          <Button
            variant="outline"
            class="w-full sm:w-auto"
            href="https://www.shadcnblocks.com"
          >
            <span class="flex items-center gap-2">
              View on GitHub
              <ArrowRight class="size-4" />
            </span>
          </Button>
        </div> -->
      </div>

      <!-- <img
        src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
        alt="Hero section demo image showing interface components"
        class="max-h-96 w-full rounded-md object-cover"
      /> -->
    </div>
  </div>
</section>

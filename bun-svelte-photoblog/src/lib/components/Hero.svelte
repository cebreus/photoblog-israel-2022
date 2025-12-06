<script lang="ts">
  // import { ArrowRight, ArrowUpRight } from '@lucide/svelte';
  // import Badge from '$lib/components/ui/badge/badge.svelte';
  // import Button from '$lib/components/ui/button/button.svelte';
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
        Izrael 2022
      </h1>

      <p
        class="text-slate-300 mb-8 max-w-xl lg:text-lg text-balance"
        data-testid="hero-description"
      >
        Fotografické střípky z výletu do Izraele a Jordánska.
      </p>

      <!-- <div
        class="flex gap-3 justify-center items-center overflow-x-auto whitespace-nowrap"
      >
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-50"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-50</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-100"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-100</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-200"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-200</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-300"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-300</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-400"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-400</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-500"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-500</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-600"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-600</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-700"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-700</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-800"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-800</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-900"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-900</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-950"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-950</span
          >
        </div>
      </div>

      <div
        class="flex gap-3 justify-center items-center overflow-x-auto whitespace-nowrap"
      >
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-50"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-50</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-100"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-100</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-200"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-200</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-300"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-300</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-400"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >slate-400</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-500"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-500</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-600"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-600</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-700"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-700</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-800"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-800</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-900"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-900</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-slate-950"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >slate-950</span
          >
        </div>
      </div>

      <div
        class="flex gap-3 justify-center items-center overflow-x-auto whitespace-nowrap"
      >
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-50"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >blue-50</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-100"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >blue-100</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-200"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >blue-200</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-300"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >blue-300</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-400"
        >
          <span
            class="text-xs font-semibold text-slate-800 bg-white/40 rounded px-1"
            >blue-400</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-500"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >blue-500</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-600"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >blue-600</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-700"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >blue-700</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-800"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >blue-800</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-900"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >blue-900</span
          >
        </div>
        <div
          class="w-28 h-16 rounded-lg flex items-end justify-center p-2 bg-blue-950"
        >
          <span
            class="text-xs font-semibold text-white bg-white/10 rounded px-1"
            >blue-950</span
          >
        </div>
      </div> -->

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
</section>

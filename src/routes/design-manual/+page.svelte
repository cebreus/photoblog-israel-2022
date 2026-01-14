<script>
  const spacing = [
    { size: 0.5, px: 2 },
    { size: 1, px: 4 },
    { size: 1.5, px: 6 },
    { size: 2, px: 8 },
    { size: 2.5, px: 10 },
    { size: 3, px: 12 },
    { size: 3.5, px: 14 },
    { size: 4, px: 16 },
    { size: 5, px: 20 },
    { size: 6, px: 24 },
    { size: 7, px: 28 },
    { size: 8, px: 32 },
    { size: 9, px: 36 },
    { size: 10, px: 40 },
    { size: 11, px: 44 },
    { size: 12, px: 48 },
    { size: 14, px: 56 },
    { size: 16, px: 64 },
    { size: 20, px: 80 },
    { size: 24, px: 96 },
    { size: 28, px: 112 },
    { size: 32, px: 128 },
    { size: 36, px: 144 },
    { size: 40, px: 160 },
    { size: 44, px: 176 },
    { size: 48, px: 192 },
    { size: 52, px: 208 },
    { size: 56, px: 224 },
    { size: 60, px: 240 },
    { size: 64, px: 256 },
    { size: 72, px: 288 },
    { size: 80, px: 320 },
    { size: 96, px: 384 },
  ];
</script>

<div class="container mx-auto space-y-16 p-8">
  <h1 class="border-b pb-6 text-5xl font-bold dark:border-slate-700">Design Manual</h1>

  <!-- Section: Colors -->
  <section>
    <h2 class="mb-8 text-4xl font-semibold">Colour Scheme</h2>
    <div class="prose prose-lg mb-12 max-w-none">
      <p class="dark:text-slate-300">
        The colour palette is a customised version of the default
        <a
          href="https://tailwindcss.com/docs/colors"
          target="_blank"
          rel="noopener noreferrer"
          class="dark:text-blue-400 dark:hover:text-blue-300">Tailwind CSS colour system</a
        >. The main neutral colour is <strong class="dark:text-white">Slate</strong>, which has been
        modified to have a richer, bluer hue and is used for backgrounds and text.
      </p>
      <p class="dark:text-slate-300">
        The primary accent colour is <strong class="dark:text-white">Blue</strong>, used for links,
        buttons, and highlighting active elements. <strong class="dark:text-white">Orange</strong>
        serves as a secondary accent for filters and notifications.
        <strong class="dark:text-white">Red</strong>
        is reserved for destructive actions and error states. All customisations can be found in
        <code class="dark:bg-slate-700 dark:text-slate-200">src/app.css</code>.
      </p>
    </div>
    <div class="grid grid-cols-12 items-center gap-x-2 gap-y-3">
      <!-- Headers -->
      <div class="text-right text-sm font-bold dark:text-slate-300">Colour</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">50</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">100</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">200</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">300</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">400</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">500</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">600</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">700</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">800</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">900</div>
      <div class="text-center font-mono text-xs dark:text-slate-400">950</div>

      <!-- Red -->
      <div class="text-right text-sm font-bold dark:text-slate-300">Red</div>
      <div class="h-12 w-full rounded-lg border bg-red-50 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-100 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-200 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-300 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-400 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-500 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-600 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-700 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-800 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-900 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-red-950 shadow-md"></div>

      <!-- Orange -->
      <div class="text-right text-sm font-bold dark:text-slate-300">Orange</div>
      <div class="h-12 w-full rounded-lg border bg-orange-50 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-100 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-200 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-300 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-400 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-500 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-600 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-700 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-800 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-900 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-orange-950 shadow-md"></div>

      <!-- Blue -->
      <div class="text-right text-sm font-bold dark:text-slate-300">Blue</div>
      <div class="h-12 w-full rounded-lg border bg-blue-50 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-100 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-200 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-300 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-400 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-500 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-600 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-700 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-800 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-900 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-blue-950 shadow-md"></div>

      <!-- Slate -->
      <div class="text-right text-sm font-bold dark:text-slate-300">Slate</div>
      <div class="h-12 w-full rounded-lg border bg-slate-50 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-100 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-200 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-300 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-400 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-500 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-600 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-700 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-800 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-900 shadow-md"></div>
      <div class="h-12 w-full rounded-lg border bg-slate-950 shadow-md"></div>
    </div>
  </section>

  <!-- Section: Typography -->
  <section>
    <h2 class="mb-8 text-4xl font-semibold">Typography</h2>
    <div class="prose prose-lg mb-12 max-w-none">
      <p class="dark:text-slate-300">
        This section is not using the <code class="dark:bg-slate-700 dark:text-slate-200"
          >@tailwindcss/typography</code
        > plugin to ensure the raw heading styles are displayed without prose styling.
      </p>
    </div>
    <div class="space-y-6">
      <h1 class="text-5xl font-bold">Heading H1</h1>
      <h2 class="text-4xl font-bold">Heading H2</h2>
      <h3 class="text-3xl font-bold">Heading H3</h3>
      <h4 class="text-2xl font-semibold">Heading H4</h4>
      <h5 class="text-xl font-semibold">Heading H5</h5>
      <h6 class="text-lg font-semibold">Heading H6</h6>
    </div>

    <div class="mt-12">
      <h3 class="mb-4 text-2xl font-medium">Font Stacks</h3>
      <p class="text-gray-700 dark:text-slate-300">
        The project currently uses the default Tailwind CSS font stacks, as no custom fonts are
        defined in either <code>tailwind.config.ts</code> or
        <code>src/app.css</code>.
      </p>
      <ul class="mt-4 list-inside list-disc space-y-2 dark:text-slate-300">
        <li>
          <span class="font-bold">Sans-serif:</span>
          <code class="text-xs dark:bg-slate-700 dark:text-slate-200"
            >'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', "Segoe UI",
            'Roboto', "Helvetica Neue", 'Arial', "Noto Sans", 'sans-serif', "Apple Color Emoji",
            "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"</code
          >
        </li>
        <li>
          <span class="font-bold">Serif:</span>
          <code class="text-xs dark:bg-slate-700 dark:text-slate-200"
            >'ui-serif', 'Georgia', 'Cambria', "Times New Roman", 'Times', 'serif'</code
          >
        </li>
        <li>
          <span class="font-bold">Monospace:</span>
          <code class="text-xs dark:bg-slate-700 dark:text-slate-200"
            >'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono",
            "Courier New", 'monospace'</code
          >
        </li>
      </ul>
    </div>
  </section>

  <!-- Section: Spacing -->
  <section>
    <h2 class="mb-8 text-4xl font-semibold">Spacing and Sizing Scale</h2>
    <p class="mb-8 text-gray-600 dark:text-slate-400">
      A visual demonstration of the default spacing and sizing scale (e.g., for padding, margin,
      width, and height) in Tailwind CSS. The values are in rem (1rem = 16px).
    </p>
    <div class="flex flex-wrap items-end gap-4">
      {#each spacing as item}
        <div class="text-center">
          <div
            class="bg-blue-200 ring-1 ring-blue-300 dark:bg-blue-800 dark:ring-blue-700"
            style="width: {item.px}px; height: {item.px}px;"
            title="Class: p-{item.size} | px: {item.px}"
          ></div>
          <p class="mt-1 text-xs dark:text-slate-400">p-{item.size}</p>
        </div>
      {/each}
    </div>
  </section>
</div>

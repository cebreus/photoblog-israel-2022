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

<div class="container mx-auto p-8 space-y-16">
  <h1 class="text-5xl font-bold border-b pb-6">Design Manual</h1>

  <!-- Section: Colors -->
  <section>
    <h2 class="text-4xl font-semibold mb-8">Colour Scheme</h2>
    <div class="prose prose-lg max-w-none mb-12">
      <p>
        The colour palette is a customised version of the default
        <a href="https://tailwindcss.com/docs/colors" target="_blank" rel="noopener noreferrer"
          >Tailwind CSS colour system</a
        >. The main neutral colour is <strong>Slate</strong>, which has been modified to have a
        richer, bluer hue and is used for backgrounds and text.
      </p>
      <p>
        The primary accent colour is <strong>Blue</strong>, used for links, buttons, and
        highlighting active elements. <strong>Orange</strong>
        serves as a secondary accent for filters and notifications.
        <strong>Red</strong>
        is reserved for destructive actions and error states. All customisations can be found in
        <code>src/app.css</code>.
      </p>
    </div>
    <div class="grid grid-cols-12 gap-x-2 gap-y-3 items-center">
      <!-- Headers -->
      <div class="font-bold text-sm text-right">Colour</div>
      <div class="text-center font-mono text-xs">50</div>
      <div class="text-center font-mono text-xs">100</div>
      <div class="text-center font-mono text-xs">200</div>
      <div class="text-center font-mono text-xs">300</div>
      <div class="text-center font-mono text-xs">400</div>
      <div class="text-center font-mono text-xs">500</div>
      <div class="text-center font-mono text-xs">600</div>
      <div class="text-center font-mono text-xs">700</div>
      <div class="text-center font-mono text-xs">800</div>
      <div class="text-center font-mono text-xs">900</div>
      <div class="text-center font-mono text-xs">950</div>

      <!-- Red -->
      <div class="font-bold text-sm text-right">Red</div>
      <div class="h-12 w-full bg-red-50 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-100 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-200 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-300 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-400 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-500 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-600 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-700 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-800 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-900 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-red-950 rounded-lg shadow-md border"></div>

      <!-- Orange -->
      <div class="font-bold text-sm text-right">Orange</div>
      <div class="h-12 w-full bg-orange-50 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-100 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-200 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-300 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-400 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-500 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-600 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-700 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-800 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-900 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-orange-950 rounded-lg shadow-md border"></div>

      <!-- Blue -->
      <div class="font-bold text-sm text-right">Blue</div>
      <div class="h-12 w-full bg-blue-50 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-100 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-200 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-300 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-400 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-500 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-600 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-700 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-800 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-900 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-blue-950 rounded-lg shadow-md border"></div>

      <!-- Slate -->
      <div class="font-bold text-sm text-right">Slate</div>
      <div class="h-12 w-full bg-slate-50 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-100 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-200 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-300 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-400 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-500 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-600 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-700 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-800 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-900 rounded-lg shadow-md border"></div>
      <div class="h-12 w-full bg-slate-950 rounded-lg shadow-md border"></div>
    </div>
  </section>

  <!-- Section: Typography -->
  <section>
    <h2 class="text-4xl font-semibold mb-8">Typography</h2>
    <div class="prose prose-lg max-w-none mb-12">
      <p>
        This section is not using the <code>@tailwindcss/typography</code> plugin to ensure the raw heading
        styles are displayed without prose styling.
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
      <h3 class="text-2xl font-medium mb-4">Font Stacks</h3>
      <p class="text-gray-700">
        The project currently uses the default Tailwind CSS font stacks, as no custom fonts are
        defined in either <code>tailwind.config.ts</code> or
        <code>src/app.css</code>.
      </p>
      <ul class="list-disc list-inside mt-4 space-y-2">
        <li>
          <span class="font-bold">Sans-serif:</span>
          <code class="text-xs"
            >'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', "Segoe UI",
            'Roboto', "Helvetica Neue", 'Arial', "Noto Sans", 'sans-serif', "Apple Color Emoji",
            "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"</code
          >
        </li>
        <li>
          <span class="font-bold">Serif:</span>
          <code class="text-xs"
            >'ui-serif', 'Georgia', 'Cambria', "Times New Roman", 'Times', 'serif'</code
          >
        </li>
        <li>
          <span class="font-bold">Monospace:</span>
          <code class="text-xs"
            >'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono",
            "Courier New", 'monospace'</code
          >
        </li>
      </ul>
    </div>
  </section>

  <!-- Section: Spacing -->
  <section>
    <h2 class="text-4xl font-semibold mb-8">Spacing and Sizing Scale</h2>
    <p class="text-gray-600 mb-8">
      A visual demonstration of the default spacing and sizing scale (e.g., for padding, margin,
      width, and height) in Tailwind CSS. The values are in rem (1rem = 16px).
    </p>
    <div class="flex flex-wrap items-end gap-4">
      {#each spacing as item}
        <div class="text-center">
          <div
            class="bg-blue-200 ring-1 ring-blue-300"
            style="width: {item.px}px; height: {item.px}px;"
            title="Class: p-{item.size} | px: {item.px}"
          ></div>
          <p class="text-xs mt-1">p-{item.size}</p>
        </div>
      {/each}
    </div>
  </section>
</div>

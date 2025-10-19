<script lang="ts">
  import Picture from '$lib/components/Picture.svelte';
  import { getManifest } from '$lib/images';

  // Načti manifest a připrav seřazené položky pro stabilní render
  const manifest = getManifest();
  const items = Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b));

  // Odvoď ALT z názvu souboru (bez přípony), nahradí _ a - mezerami
  function fileNameToAlt(key: string): string {
    const last = key.split('/').pop() ?? '';
    const name = last.replace(/\.[^.]+$/, '');
    return name.replace(/[_-]+/g, ' ');
  }

  // Responsive sizes pro mřížku 2/3/4 sloupce
  const sizes = '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';
</script>

<main class="container mx-auto p-4">
  <h1 class="text-2xl font-semibold mb-4">Israel 2022</h1>

  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {#each items as [key, entry] (key)}
      <Picture
        srcKey={key}
        alt={fileNameToAlt(key)}
        {sizes}
        placeholder="background"
        class="block rounded overflow-hidden"
      />
    {/each}
  </div>
</main>

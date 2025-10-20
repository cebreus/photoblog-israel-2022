import manifest from '$lib/images.manifest.json';

/**
 * Server-side load funkce pro hlavní stránku fotoblogu.
 * Načítá data z před-vygenerovaného manifestu a předává je komponentě.
 * Logika je minimální, protože veškerá komplexita je již vyřešena
 * v buildovacím skriptu.
 */
export async function load() {
  const photoDays = (manifest as any).photoDays || [];

  return {
    days: photoDays
  };
}

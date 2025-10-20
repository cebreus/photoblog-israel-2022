import type { PhotoDay, MenuManifest } from '$lib/types/manifest';
import days from '$lib/images.manifest.json' with { type: 'json' };
import menu from '$lib/menu.manifest.json' with { type: 'json' };

/**
 * Server load that exposes the days-only manifest. Generator writes an array of day groups.
 */
export async function load() {
  try {
    const photoDays: PhotoDay[] = (days as any)?.photoDays || [];
    const menuData: MenuManifest = menu || [];

    return { dataset: photoDays, menu: menuData };
  } catch (err) {
    return { dataset: [], menu: [] };
  }
}


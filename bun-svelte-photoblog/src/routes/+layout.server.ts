import type { PhotoDay, MenuManifest } from '$lib/types/manifest';
import { getPhotoDays, getMenuItems } from '$lib';

/**
 * Server load that exposes the days-only manifest. Generator writes an array of day groups.
 */
export async function load() {
  const photoDays: PhotoDay[] = getPhotoDays();
  const menuItems: MenuManifest = getMenuItems();

  return { dataset: photoDays, menu: menuItems };
}


import type { PhotoDay } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";

export async function load() {
  // CRITICAL: Must reload manifests BEFORE getPhotoDays to avoid stale cache
  if (import.meta.env.DEV) {
    const { reloadManifests } = await import("$lib/utils/images");
    await reloadManifests();
  }

  const photoDays: PhotoDay[] = getPhotoDays();

  return {
    photoDays,
  };
}

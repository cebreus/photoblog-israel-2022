import type { PhotoDay } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";

export async function load() {
  // NOTE: Manifest reload is handled in +layout.server.ts
  // We do NOT need to call it here again, to avoid double I/O on invalidateAll()

  const photoDays: PhotoDay[] = getPhotoDays();

  return {
    photoDays,
  };
}

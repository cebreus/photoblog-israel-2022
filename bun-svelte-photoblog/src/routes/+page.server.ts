import type { PhotoDay } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/images";

export async function load() {
  const photoDays: PhotoDay[] = getPhotoDays();

  return {
    photoDays,
  };
}

import type { PhotoDay } from "$lib/types/manifest";
import { getPhotoDays } from "$lib/utils/images";

export async function load() {
  const photoDays: PhotoDay[] = getPhotoDays();

  return {
    photoDays,
  };
}

import { getPhotoDays, getMenuItems } from "$lib";
import type { MenuManifest } from "$lib/types/manifest";

export const load = async () => {
  const photoDays = getPhotoDays();
  const menuItems: MenuManifest = getMenuItems();

  return {
    photoDays,
    menuItems,
  };
};

import type { MenuManifest } from "$lib/types/manifest";
import menuManifest from "$lib/menu.manifest.json" with { type: "json" };

const menuItems: MenuManifest = Array.isArray(menuManifest)
  ? (menuManifest as MenuManifest)
  : [];

export function getMenuItems(): MenuManifest {
  return menuItems;
}

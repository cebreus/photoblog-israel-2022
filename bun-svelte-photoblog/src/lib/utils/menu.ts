import type { MenuManifest } from "$lib/types/manifest";
import menuManifest from "$manifests/menu.manifest.json" with { type: "json" };

function isMenuManifest(x: unknown): x is MenuManifest {
  return Array.isArray(x);
}

const menuItems: MenuManifest = isMenuManifest(menuManifest)
  ? menuManifest
  : [];

export function getMenuItems(): MenuManifest {
  return menuItems;
}

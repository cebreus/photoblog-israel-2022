import { getPhotoDays, getMenuItems, getSiteManifest } from "$lib";
import type {
  MenuManifest,
  PhotoDay,
  Author,
  SiteManifest,
} from "$lib/types/manifest";
import { toSlug } from "$lib/utils/strings"; // Corrected import

function gatherAuthors(photoDays: PhotoDay[]): Author[] {
  const counts = new Map<string, number>();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type !== "image") continue;

      // use canonical top-level author only
      // use canonical top-level author only
      const rawAuthor = item.author || "";
      
      counts.set(rawAuthor, (counts.get(rawAuthor) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name: name || "Bez autora",
      count,
      slug: name ? toSlug(name) : "", // Using toSlug
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const load = async () => {
  const photoDays = getPhotoDays();
  const menuItems: MenuManifest = getMenuItems();
  const authors: Author[] = gatherAuthors(photoDays);
  const siteManifest: SiteManifest = getSiteManifest();

  return {
    photoDays,
    menuItems,
    authors,
    siteManifest,
  };
};

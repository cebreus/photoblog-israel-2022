import { getPhotoDays, getMenuItems } from "$lib";
import type { MenuManifest, PhotoDay } from "$lib/types/manifest";

type AuthorStats = {
  name: string;
  count: number;
};

function gatherAuthors(photoDays: PhotoDay[]): AuthorStats[] {
  const counts = new Map<string, number>();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type !== "image") continue;

      // use canonical top-level author only
      const rawAuthor = item.author;
      if (!rawAuthor) continue;

      counts.set(rawAuthor, (counts.get(rawAuthor) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const load = async () => {
  const photoDays = getPhotoDays();
  const menuItems: MenuManifest = getMenuItems();
  const authors: AuthorStats[] = gatherAuthors(photoDays);

  return {
    photoDays,
    menuItems,
    authors,
  };
};

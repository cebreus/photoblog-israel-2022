import {
  getCurationManifest,
  getMenuItems,
  getPeopleManifest,
  getPhotoDays,
  getSiteManifest,
} from "$lib";
import type {
  Author,
  MenuManifest,
  PeopleManifest,
  PhotoDay,
  SiteManifest,
} from "$lib/types/manifest";
import { toSlug } from "$lib/utils/strings";

const UNKNOWN_AUTHOR = "Neuvedeno";

function gatherAuthors(photoDays: PhotoDay[]): Author[] {
  const counts = new Map<string, number>();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type !== "image") continue;

      // use canonical top-level author only
      let rawAuthor = item.author || "";

      if (!rawAuthor.trim()) {
        rawAuthor = UNKNOWN_AUTHOR;
      }

      counts.set(rawAuthor, (counts.get(rawAuthor) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
      slug: toSlug(name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function gatherQualityStats(photoDays: PhotoDay[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type !== "image") continue;

      const bucket = item.analysis?.qualityBucket;
      if (bucket) {
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
    }
  }

  return counts;
}

export const load = async () => {
  const photoDays = getPhotoDays();
  const menuItems: MenuManifest = getMenuItems();
  const authors: Author[] = gatherAuthors(photoDays);
  const qualityStats = gatherQualityStats(photoDays);
  const siteManifest: SiteManifest = getSiteManifest();
  const curationManifest = getCurationManifest();
  const peopleManifest: PeopleManifest = getPeopleManifest();

  return {
    photoDays,
    menuItems,
    authors,
    qualityStats,
    siteManifest,
    curationManifest,
    peopleManifest,
  };
};

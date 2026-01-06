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
      } else {
        // Count images without bucket as "unrated"
        counts.set("unrated", (counts.get("unrated") ?? 0) + 1);
      }
    }
  }

  return counts;
}

export const load = async () => {
  if (import.meta.env.DEV) {
    const { reloadManifests } = await import("$lib/utils/manifest-loader");
    await reloadManifests();
  }

  const photoDays = getPhotoDays();
  const menuItems: MenuManifest = getMenuItems();
  const authors: Author[] = gatherAuthors(photoDays);
  const qualityStats = gatherQualityStats(photoDays);
  const mediaStats = gatherMediaStats(photoDays);
  const snapshotStats = gatherSnapshotStats(photoDays);
  const siteManifest: SiteManifest = getSiteManifest();
  const curationManifest = getCurationManifest();
  const peopleManifest: PeopleManifest = getPeopleManifest();

  return {
    photoDays,
    menuItems,
    authors,
    qualityStats,
    mediaStats,
    snapshotStats,
    siteManifest,
    curationManifest,
    peopleManifest,
  };
};

function gatherMediaStats(photoDays: PhotoDay[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type === "separator") continue;
      // Items are already reclassified by the manifest loader (in images.ts)
      // so item.type will correctly be "panorama" or "collage" where applicable.
      const type = item.type;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }

  return counts;
}

function gatherSnapshotStats(photoDays: PhotoDay[]): {
  total: number;
  author: number;
  others: number;
} {
  let total = 0;
  let author = 0;
  let others = 0;

  for (const day of photoDays) {
    for (const item of day.items) {
      if (item.type === "separator") continue;
      if (!item.flags) continue;

      const isAuthor = item.flags.includes("snapshot-author");
      const isOthers = item.flags.includes("snapshot-others");

      if (isAuthor) author++;
      if (isOthers) others++;
      if (isAuthor || isOthers) total++;
    }
  }

  return { total, author, others };
}

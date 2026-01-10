import type { ImageEntry, PeopleManifest, Person, PhotoDay } from "$lib/types/manifest";
import { getManifest, getPeopleManifest } from "$lib/utils/images";

function bustItemPath(path: string, ts: number) {
  if (!path) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}t=${ts}`;
}

function createManifestStore() {
  // Initialize with static data for SSR/first render
  let people = $state<Person[]>(getPeopleManifest().people || []);
  let photoDays = $state<PhotoDay[]>(getManifest().photoDays || []);

  /**
   * Updates the store with fresh data specifically from SvelteKit's load functions.
   * This is typically called in +layout.svelte or +page.svelte effects.
   */
  function update(
    data: { photoDays?: PhotoDay[]; peopleManifest?: PeopleManifest } | null | undefined,
  ) {
    if (!data) return;

    if (data.photoDays) {
      photoDays = data.photoDays;
    }
    if (data.peopleManifest?.people) {
      people = data.peopleManifest.people;
    }
  }

  /**
   * Manually updates a single item in the store and appends a cache-buster
   * to ensure the browser fetches the new image variant immediately.
   */
  function refreshItem(updatedItem: ImageEntry) {
    if (!updatedItem?.id) return;

    for (const day of photoDays) {
      const idx = day.items.findIndex(function findItemById(item: ImageEntry | { id?: string }) {
        return item.id === updatedItem.id;
      });

      if (idx !== -1) {
        // Clone to ensure reactivity
        const newItem = { ...(day.items[idx] as ImageEntry), ...updatedItem };
        const ts = Date.now();

        // Cache bust all known image paths
        if (newItem.sources) {
          const freshSources = [];
          for (const s of newItem.sources) {
            freshSources.push({
              ...s,
              path: bustItemPath(s.path, ts),
            });
          }
          newItem.sources = freshSources;
        }

        // Also legacy/root paths if used
        if (newItem.src) newItem.src = bustItemPath(newItem.src, ts);

        day.items[idx] = newItem;
        return; // Found and updated
      }
    }
  }

  return {
    get people() {
      return people;
    },
    set people(v) {
      people = v;
    },
    get photoDays() {
      return photoDays;
    },
    set photoDays(v) {
      photoDays = v;
    },
    update,
    refreshItem,
  };
}

export const manifest = createManifestStore();

import type { ImageEntry, PeopleManifest, Person, PhotoDay } from "$lib/types/manifest";
import { getManifest, getPeopleManifest } from "$lib/utils/images";

export class ManifestStore {
  // Initialize with static data for SSR/first render
  people = $state<Person[]>(getPeopleManifest().people || []);
  photoDays = $state<PhotoDay[]>(getManifest().photoDays || []);

  /**
   * Updates the store with fresh data specifically from SvelteKit's load functions.
   * This is typically called in +layout.svelte or +page.svelte effects.
   */
  update(data: { photoDays?: PhotoDay[]; peopleManifest?: PeopleManifest } | null | undefined) {
    if (!data) return;

    if (data.photoDays) {
      this.photoDays = data.photoDays;
    }
    if (data.peopleManifest?.people) {
      this.people = data.peopleManifest.people;
    }
  }

  // Helper to refresh data if we ever need to pull manually (though push from layout is preferred)
  // But strictly, we rely on SvelteKit's invalidateAll() -> load() -> update() flow.

  /**
   * Manually updates a single item in the store and appends a cache-buster
   * to ensure the browser fetches the new image variant immediately.
   */
  refreshItem(updatedItem: ImageEntry) {
    if (!updatedItem?.id) return;

    for (const day of this.photoDays) {
      const idx = day.items.findIndex((i) => i.id === updatedItem.id);
      if (idx !== -1) {
        // Clone to ensure reactivity
        const newItem = { ...day.items[idx], ...updatedItem };
        const ts = Date.now();

        // Helper to append timestamp
        const bust = (path: string) => {
          if (!path) return path;
          const sep = path.includes("?") ? "&" : "?";
          return `${path}${sep}t=${ts}`;
        };

        // Cache bust all known image paths
        if (newItem.sources) {
          newItem.sources = newItem.sources.map((s) => ({
            ...s,
            path: bust(s.path),
          }));
        }

        // Also legacy/root paths if used
        if (newItem.src) newItem.src = bust(newItem.src);

        day.items[idx] = newItem;
        return; // Found and updated
      }
    }
  }
}

export const manifest = new ManifestStore();

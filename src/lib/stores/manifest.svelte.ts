import type { PeopleManifest, Person, PhotoDay } from "$lib/types/manifest";
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
}

export const manifest = new ManifestStore();

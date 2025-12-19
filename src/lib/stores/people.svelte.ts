import type { Manifest, PeopleManifest, Person } from "$lib/types/manifest";
import { getManifest, getPeopleManifest } from "$lib/utils/images";
import { enrichPeopleWithStats } from "$lib/utils/people";

export class PeopleState {
  people = $state<Person[]>(getPeopleManifest().people || []);
  photoDays = $state(getManifest().photoDays || []);

  peopleWithStats = $derived(enrichPeopleWithStats(this.people, this.photoDays));

  async refresh() {
    if (typeof fetch === "undefined") return;

    try {
      const [pRes, iRes] = await Promise.all([
        fetch("/api/manifest/people"),
        fetch("/api/manifest/images"),
      ]);

      if (pRes.ok) {
        const pData: PeopleManifest = await pRes.json();
        this.people = pData.people;
      }

      if (iRes.ok) {
        const iData: Manifest = await iRes.json();
        this.photoDays = iData.photoDays;
      }
    } catch (_e) {}
  }
}

export const people = new PeopleState();

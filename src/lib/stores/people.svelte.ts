import type { Manifest, PeopleManifest, Person } from "$lib/types/manifest";
import { getManifest, getPeopleManifest } from "$lib/utils/images";
import { enrichPeopleWithStats, getVisiblePeople } from "$lib/utils/people";

export class PeopleState {
  people = $state<Person[]>(getPeopleManifest().people || []);
  photoDays = $state(getManifest().photoDays || []);

  peopleWithStats = $derived(enrichPeopleWithStats(this.people, this.photoDays));

  // Filter people by ignored flag from manifest AND hide empty profiles
  visiblePeople = $derived(getVisiblePeople(this.peopleWithStats));

  // Hidden list shows only"person" category (statue/painting stay in their accordions even if ignored)
  hiddenPeople = $derived(
    this.peopleWithStats
      .filter((p) => p.ignored && (!p.category || p.category === "person"))
      .sort((a, b) => b.faceCount - a.faceCount),
  );

  // Category lists (based on visible/active people)
  categoryPeople = $derived(
    this.peopleWithStats
      .filter((p) => !p.category || p.category === "person")
      .sort((a, b) => b.faceCount - a.faceCount),
  );

  categoryStatues = $derived(
    this.peopleWithStats
      .filter((p) => p.category === "statue")
      .sort((a, b) => b.faceCount - a.faceCount),
  );

  categoryPaintings = $derived(
    this.peopleWithStats
      .filter((p) => p.category === "painting")
      .sort((a, b) => b.faceCount - a.faceCount),
  );

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

import { invalidateAll } from "$app/navigation";
import type { Person, PhotoDay } from "$lib/types/manifest";
import { getManifest, getPeopleManifest } from "$lib/utils/images";
import { enrichPeopleWithStats, getVisiblePeople } from "$lib/utils/people";

export class PeopleState {
  people = $state<Person[]>(getPeopleManifest().people || []);
  photoDays = $state(getManifest().photoDays || []);

  peopleWithStats = $derived(enrichPeopleWithStats(this.people, this.photoDays));

  // Filter people by ignored flag from manifest, hide empty profiles, and show ONLY persons (no statues/paintings)
  visiblePeople = $derived(
    getVisiblePeople(this.peopleWithStats.filter((p) => !p.category || p.category === "person")),
  );

  // Hidden list shows only"person" category (statue/painting stay in their accordions even if ignored)
  hiddenPeople = $derived(
    this.peopleWithStats
      .filter(
        (p) => p.hidden && !p.junk && p.faceCount > 0 && (!p.category || p.category === "person"),
      )
      .sort((a, b) => b.faceCount - a.faceCount),
  );

  // Category lists (based on visible/active people)
  categoryPeople = $derived(
    this.peopleWithStats
      .filter((p) => (!p.category || p.category === "person") && !p.junk && p.faceCount > 0)
      .sort((a, b) => b.faceCount - a.faceCount),
  );

  categoryStatues = $derived(
    this.peopleWithStats
      .filter((p) => p.category === "statue" && !p.junk && p.faceCount > 0)
      .sort((a, b) => b.faceCount - a.faceCount),
  );

  categoryPaintings = $derived(
    this.peopleWithStats
      .filter((p) => p.category === "painting" && !p.junk && p.faceCount > 0)
      .sort((a, b) => b.faceCount - a.faceCount),
  );

  // Junk list shows all junk entities regardless of category
  junkPeople = $derived(
    this.peopleWithStats.filter((p) => p.junk === true).sort((a, b) => b.faceCount - a.faceCount),
  );

  async refresh() {
    await invalidateAll();
  }

  setPeople(people: Person[]) {
    this.people = people;
  }

  setPhotoDays(photoDays: PhotoDay[]) {
    this.photoDays = photoDays;
  }
}

export const people = new PeopleState();

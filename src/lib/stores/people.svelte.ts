import { invalidateAll } from "$app/navigation";
import type { Person, PhotoDay } from "$lib/types/manifest";
import { enrichPeopleWithStats, getVisiblePeople } from "$lib/utils/people";
import { manifest } from "./manifest.svelte";

export class PeopleState {
  // Directly derived from the central manifest store
  people = $derived<Person[]>(manifest.people);
  photoDays = $derived<PhotoDay[]>(manifest.photoDays);

  peopleWithStats = $derived.by(() => {
    if (typeof performance !== "undefined") {
      performance.mark("people-enrich-start");
    }

    const result = enrichPeopleWithStats(this.people, this.photoDays);

    if (typeof performance !== "undefined") {
      performance.mark("people-enrich-end");
      performance.measure("people-enrich", "people-enrich-start", "people-enrich-end");

      performance.clearMarks("people-enrich-start");
      performance.clearMarks("people-enrich-end");
      performance.clearMeasures("people-enrich");
    }

    return result;
  });

  // Filter people by ignored flag from manifest, hide empty profiles, and show ONLY persons (no statues/paintings)
  visiblePeople = $derived(
    getVisiblePeople(this.peopleWithStats.filter((p) => !p.category || p.category === "person")),
  );

  // Hidden list shows only "person" category (statue/painting stay in their accordions even if ignored)
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

  junkPeople = $derived(
    this.peopleWithStats.filter((p) => p.junk === true).sort((a, b) => b.faceCount - a.faceCount),
  );

  lastUpdateTimestamp = $state(Date.now());

  async refresh() {
    await invalidateAll();
    this.lastUpdateTimestamp = Date.now();
  }
}

export const people = new PeopleState();

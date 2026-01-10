import { invalidateAll } from "$app/navigation";
import type { Person, PhotoDay } from "$lib/types/manifest";
import { getVisiblePeople } from "$lib/utils/people";
import { manifest } from "./manifest.svelte";

function isPerson(p: Person) {
  return !p.category || p.category === "person";
}

function isHiddenPerson(p: Person) {
  return p.hidden && !p.junk && p.faceCount > 0 && (!p.category || p.category === "person");
}

function sortByFaceCount(a: Person, b: Person) {
  return b.faceCount - a.faceCount;
}

function isVisiblePerson(p: Person) {
  return (!p.category || p.category === "person") && !p.junk && p.faceCount > 0;
}

function isStatue(p: Person) {
  return p.category === "statue" && !p.junk && p.faceCount > 0;
}

function isPainting(p: Person) {
  return p.category === "painting" && !p.junk && p.faceCount > 0;
}

function isJunk(p: Person) {
  return p.junk === true;
}

function createPeopleState() {
  // Directly derived from the central manifest store
  const people = $derived<Person[]>(manifest.people);
  const photoDays = $derived<PhotoDay[]>(manifest.photoDays);

  // Now strictly equal to manifest people, as enrichment happens on Backend/Build
  const peopleWithStats = $derived(people);

  // Filter people by ignored flag from manifest, hide empty profiles, and show ONLY persons (no statues/paintings)
  const visiblePeople = $derived(getVisiblePeople(peopleWithStats.filter(isPerson)));

  // Hidden list shows only "person" category (statue/painting stay in their accordions even if ignored)
  const hiddenPeople = $derived(peopleWithStats.filter(isHiddenPerson).sort(sortByFaceCount));

  // Category lists (based on visible/active people)
  const categoryPeople = $derived(peopleWithStats.filter(isVisiblePerson).sort(sortByFaceCount));

  const categoryStatues = $derived(peopleWithStats.filter(isStatue).sort(sortByFaceCount));

  const categoryPaintings = $derived(peopleWithStats.filter(isPainting).sort(sortByFaceCount));

  const junkPeople = $derived(peopleWithStats.filter(isJunk).sort(sortByFaceCount));

  let lastUpdateTimestamp = $state(Date.now());

  async function refresh() {
    await invalidateAll();
    lastUpdateTimestamp = Date.now();
  }

  return {
    get people() {
      return people;
    },
    get photoDays() {
      return photoDays;
    },
    get peopleWithStats() {
      return peopleWithStats;
    },
    get visiblePeople() {
      return visiblePeople;
    },
    get hiddenPeople() {
      return hiddenPeople;
    },
    get categoryPeople() {
      return categoryPeople;
    },
    get categoryStatues() {
      return categoryStatues;
    },
    get categoryPaintings() {
      return categoryPaintings;
    },
    get junkPeople() {
      return junkPeople;
    },
    get lastUpdateTimestamp() {
      return lastUpdateTimestamp;
    },
    set lastUpdateTimestamp(v) {
      lastUpdateTimestamp = v;
    },
    refresh,
  };
}

export const people = createPeopleState();

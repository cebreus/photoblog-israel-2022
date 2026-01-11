import { invalidate } from "$app/navigation";
import type { Person, PhotoDay } from "$lib/types/manifest";
import { enrichPeopleWithStats } from "$lib/utils/people";
import { manifest } from "./manifest.svelte";

function sortByFaceCount(a: Person, b: Person) {
  return b.faceCount - a.faceCount;
}

function isJunk(p: Person) {
  return p.junk === true;
}

function createPeopleState() {
  // Directly derived from the central manifest store
  const people = $derived<Person[]>(manifest.people);
  const photoDays = $derived<PhotoDay[]>(manifest.photoDays);

  // Perform client-side enrichment to ensure faceCount aligns with visible images
  const peopleWithStats = $derived(enrichPeopleWithStats(people, photoDays));

  // Display lists (Grouped by Category, Not Junk) - Includes Hidden
  const displayPersons = $derived(
    peopleWithStats
      .filter((p) => (!p.category || p.category === "person") && !p.junk)
      .sort(sortByFaceCount),
  );

  const displayStatues = $derived(
    peopleWithStats.filter((p) => p.category === "statue" && !p.junk).sort(sortByFaceCount),
  );

  const displayPaintings = $derived(
    peopleWithStats.filter((p) => p.category === "painting" && !p.junk).sort(sortByFaceCount),
  );

  const displayJunk = $derived(peopleWithStats.filter(isJunk).sort(sortByFaceCount));

  let lastUpdateTimestamp = $state(Date.now());

  async function refresh() {
    await invalidate("app:people-manifest");
    lastUpdateTimestamp = Date.now();
  }

  function optimisticMerge(sourceIds: string[], targetId: string) {
    const currentPeople = manifest.people;
    if (!currentPeople) return;

    const targetPerson = currentPeople.find((p) => p.id === targetId);
    if (!targetPerson) return;

    // Calculate stats to add
    const sources = currentPeople.filter((p) => sourceIds.includes(p.id));
    const addedFaces = sources.reduce((sum, p) => sum + (p.faceCount || 0), 0);

    // Update target
    targetPerson.faceCount = (targetPerson.faceCount || 0) + addedFaces;

    // Remove sources
    const newPeople = currentPeople.filter((p) => !sourceIds.includes(p.id));

    // Update manifest store
    manifest.people = newPeople;
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
    get displayPersons() {
      return displayPersons;
    },
    get displayStatues() {
      return displayStatues;
    },
    get displayPaintings() {
      return displayPaintings;
    },
    get displayJunk() {
      return displayJunk;
    },
    get lastUpdateTimestamp() {
      return lastUpdateTimestamp;
    },
    set lastUpdateTimestamp(v) {
      lastUpdateTimestamp = v;
    },
    refresh,
    optimisticMerge,
  };
}

export const people = createPeopleState();

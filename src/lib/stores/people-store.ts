import type { Manifest, PeopleManifest, Person } from "$lib/types/manifest";
import { getManifest, getPeopleManifest } from "$lib/utils/images";
import { enrichPeopleWithStats } from "$lib/utils/people";
import { derived, writable } from "svelte/store";

function createPeopleStore() {
  const initialPeople = getPeopleManifest().people || [];
  const initialPhotoDays = getManifest().photoDays || [];

  const peopleStore = writable<Person[]>(initialPeople);
  const photoDaysStore = writable(initialPhotoDays);

  return {
    subscribe: peopleStore.subscribe,
    setPeople: peopleStore.set,
    photoDays: photoDaysStore,

    refresh: async () => {
      if (typeof fetch === "undefined") return;

      try {
        const [pRes, iRes] = await Promise.all([
          fetch("/api/manifest/people"),
          fetch("/api/manifest/images"),
        ]);

        if (pRes.ok) {
          const pData: PeopleManifest = await pRes.json();
          peopleStore.set(pData.people);
        }

        if (iRes.ok) {
          const iData: Manifest = await iRes.json();
          photoDaysStore.set(iData.photoDays);
        }
      } catch (e) {
        console.error("Failed to refresh manifests", e);
      }
    },
  };
}

export const peopleBase = createPeopleStore();

export const peopleWithStats = derived(
  [peopleBase, peopleBase.photoDays],
  ([$people, $photoDays]) => enrichPeopleWithStats($people, $photoDays),
);

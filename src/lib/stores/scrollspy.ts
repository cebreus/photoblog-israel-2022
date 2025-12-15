import { writable } from "svelte/store";

// A writable store to hold the IDs of currently visible (intersecting) sections.
// Using a Set allows for easy addition/removal and ensures uniqueness.
export const activeSectionIds = writable(new Set<string>());

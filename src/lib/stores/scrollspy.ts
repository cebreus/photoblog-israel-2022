import { writable } from "svelte/store";

export const activeSectionIds = writable(new Set<string>());

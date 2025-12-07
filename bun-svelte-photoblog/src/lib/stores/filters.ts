import { writable } from "svelte/store";

export const selectedAuthors = writable<string[]>([]);
export const showSeparators = writable(true);
export const filtersSyncing = writable(false);

import { writable } from "svelte/store";

/**
 * Controls whether image location badges (rendered via ::after on <figure>) are visible.
 */
export const showLocationPins = writable(false);

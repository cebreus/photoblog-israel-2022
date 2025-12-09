import { writable } from "svelte/store";

/**
 * Controls whether image labels/captions (rendered via ::after on <figure>) are visible.
 */
export const showPhotoLabels = writable(false);

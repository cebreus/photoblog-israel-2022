import { MediaQuery } from "svelte/reactivity";

const DEFAULT_MOBILE_BREAKPOINT = 768;

export function createIsMobile(breakpoint: number = DEFAULT_MOBILE_BREAKPOINT) {
  return new MediaQuery(`max-width: ${breakpoint - 1}px`);
}

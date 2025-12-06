import type { Writable } from "svelte/store";

export const OFFCANVAS_CONTEXT_KEY = Symbol("OffcanvasContext");

export interface OffcanvasContext {
  openStore: Writable<boolean>;
  toggleOpen: () => void;
}

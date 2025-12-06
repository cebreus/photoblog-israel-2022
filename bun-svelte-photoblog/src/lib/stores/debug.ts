import { writable } from "svelte/store";
import { goto } from "$app/navigation";
import { browser } from "$app/environment";

const createDebugStore = () => {
  const { subscribe, set } = writable(false);

  function initializeFromUrl(url: URL) {
    if (!browser) return;
    const hasDebugParam = url.searchParams.has("debug");
    set(hasDebugParam);
  }

  function enable() {
    if (!browser) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("debug")) {
      url.searchParams.set("debug", "true");
      goto(url, { noScroll: true });
    }
  }

  return {
    subscribe,
    initializeFromUrl,
    enable,
  };
};

export const debug = createDebugStore();

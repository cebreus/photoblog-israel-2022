import { writable } from "svelte/store";

function createSelectionStore() {
  const { subscribe, set, update } = writable<Set<string>>(new Set());

  return {
    subscribe,
    toggle: (id: string) =>
      update((ids) => {
        if (ids.has(id)) {
          ids.delete(id);
        } else {
          ids.add(id);
        }
        return new Set(ids);
      }),
    clear: () => set(new Set()),
    set: (ids: Set<string>) => set(ids),
    add: (id: string) =>
      update((ids) => {
        ids.add(id);
        return new Set(ids);
      }),
    remove: (id: string) =>
      update((ids) => {
        ids.delete(id);
        return new Set(ids);
      }),
  };
}

export const selection = createSelectionStore();

function createEditModeStore() {
  const { subscribe, set, update } = writable(false);

  return {
    subscribe,
    set,
    toggle: () => update((v) => !v),
    enable: () => set(true),
    disable: () => set(false),
  };
}

export const editMode = createEditModeStore();

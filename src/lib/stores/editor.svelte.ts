import { createLogger } from "$lib/logger";

const logger = createLogger("editor-store");

function createEditorStore() {
  let selection = $state(new Set<string>());
  let editMode = $state(false);
  let showMetadataOverlay = $state(false);

  function updateSelection(fn: (s: Set<string>) => void) {
    const next = new Set(selection);
    fn(next);
    selection = next;
  }

  return {
    get selection() {
      return selection;
    },
    set selection(v: Set<string>) {
      if (!(v instanceof Set)) {
        logger.error("Invalid selection value, expected Set", v);
        return;
      }
      selection = v;
    },
    get editMode() {
      return editMode;
    },
    set editMode(value: boolean) {
      editMode = value;
      if (!value) {
        selection = new Set();
      }
    },
    get showMetadataOverlay() {
      return showMetadataOverlay;
    },
    set showMetadataOverlay(value: boolean) {
      showMetadataOverlay = value;
    },

    toggleSelection(id: string) {
      updateSelection((s) => (s.has(id) ? s.delete(id) : s.add(id)));
    },

    addSelection(id: string) {
      updateSelection((s) => s.add(id));
    },

    removeSelection(id: string) {
      updateSelection((s) => s.delete(id));
    },

    clearSelection() {
      selection = new Set();
    },

    setSelection(ids: Set<string>) {
      selection = ids;
    },

    addMultiple(ids: string[]) {
      updateSelection((s) => {
        for (const id of ids) s.add(id);
      });
    },

    removeMultiple(ids: string[]) {
      updateSelection((s) => {
        for (const id of ids) s.delete(id);
      });
    },

    toggleEditMode() {
      editMode = !editMode;
      if (!editMode) {
        selection = new Set();
      }
    },

    setEditMode(value: boolean) {
      editMode = value;
      if (!value) {
        selection = new Set();
      }
    },

    setShowMetadataOverlay(value: boolean) {
      showMetadataOverlay = value;
    },
  };
}

export const editor = createEditorStore();

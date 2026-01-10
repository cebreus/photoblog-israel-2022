import { createLogger } from "$lib/logger";

const logger = createLogger("editor-store");

/**
 * Editor state store - manages selection and edit mode.
 * Uses class-based pattern for consistency with other stores.
 */
function createEditorState() {
  let selection = $state(new Set<string>());
  let editMode = $state(false);
  let showMetadataOverlay = $state(false);
  /** When true, drag & drop reordering is enabled in edit mode */
  let reorderMode = $state(false);

  function updateSelection(fn: (s: Set<string>) => void) {
    const next = new Set(selection);
    fn(next);
    selection = next;
  }

  function toggleSelection(id: string) {
    function mutateSelection(s: Set<string>) {
      if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
      }
    }
    updateSelection(mutateSelection);
  }

  function addSelection(id: string) {
    function mutateSelection(s: Set<string>) {
      s.add(id);
    }
    updateSelection(mutateSelection);
  }

  function removeSelection(id: string) {
    function mutateSelection(s: Set<string>) {
      s.delete(id);
    }
    updateSelection(mutateSelection);
  }

  function clearSelection() {
    selection = new Set();
  }

  function setSelection(ids: Set<string>) {
    if (!(ids instanceof Set)) {
      logger.error({ ids }, "Invalid selection value, expected Set");
      return;
    }
    selection = ids;
  }

  function addMultiple(ids: string[]) {
    function mutateSelection(s: Set<string>) {
      for (const id of ids) s.add(id);
    }
    updateSelection(mutateSelection);
  }

  function removeMultiple(ids: string[]) {
    function mutateSelection(s: Set<string>) {
      for (const id of ids) s.delete(id);
    }
    updateSelection(mutateSelection);
  }

  function toggleEditMode() {
    editMode = !editMode;
    if (!editMode) {
      selection = new Set();
    }
  }

  function setEditMode(value: boolean) {
    editMode = value;
    if (!value) {
      selection = new Set();
    }
  }

  function setShowMetadataOverlay(value: boolean) {
    showMetadataOverlay = value;
  }

  function setReorderMode(value: boolean) {
    reorderMode = value;
  }

  function toggleReorderMode() {
    reorderMode = !reorderMode;
  }

  return {
    get selection() {
      return selection;
    },
    set selection(v) {
      selection = v;
    },
    get editMode() {
      return editMode;
    },
    set editMode(v) {
      editMode = v;
    },
    get showMetadataOverlay() {
      return showMetadataOverlay;
    },
    set showMetadataOverlay(v) {
      showMetadataOverlay = v;
    },
    get reorderMode() {
      return reorderMode;
    },
    set reorderMode(v) {
      reorderMode = v;
    },
    toggleSelection,
    addSelection,
    removeSelection,
    clearSelection,
    setSelection,
    addMultiple,
    removeMultiple,
    toggleEditMode,
    setEditMode,
    setShowMetadataOverlay,
    setReorderMode,
    toggleReorderMode,
  };
}

export const editor = createEditorState();

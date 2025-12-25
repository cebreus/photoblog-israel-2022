import { createLogger } from "$lib/logger";

const logger = createLogger("editor-store");

/**
 * Editor state store - manages selection and edit mode.
 * Uses class-based pattern for consistency with other stores.
 */
export class EditorState {
  selection = $state(new Set<string>());
  editMode = $state(false);
  showMetadataOverlay = $state(false);

  private updateSelection(fn: (s: Set<string>) => void) {
    const next = new Set(this.selection);
    fn(next);
    this.selection = next;
  }

  toggleSelection(id: string) {
    this.updateSelection((s) => (s.has(id) ? s.delete(id) : s.add(id)));
  }

  addSelection(id: string) {
    this.updateSelection((s) => s.add(id));
  }

  removeSelection(id: string) {
    this.updateSelection((s) => s.delete(id));
  }

  clearSelection() {
    this.selection = new Set();
  }

  setSelection(ids: Set<string>) {
    if (!(ids instanceof Set)) {
      logger.error("Invalid selection value, expected Set", ids);
      return;
    }
    this.selection = ids;
  }

  addMultiple(ids: string[]) {
    this.updateSelection((s) => {
      for (const id of ids) s.add(id);
    });
  }

  removeMultiple(ids: string[]) {
    this.updateSelection((s) => {
      for (const id of ids) s.delete(id);
    });
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    if (!this.editMode) {
      this.selection = new Set();
    }
  }

  setEditMode(value: boolean) {
    this.editMode = value;
    if (!value) {
      this.selection = new Set();
    }
  }

  setShowMetadataOverlay(value: boolean) {
    this.showMetadataOverlay = value;
  }
}

export const editor = new EditorState();

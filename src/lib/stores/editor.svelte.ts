export class EditorState {
  #selection = $state(new Set<string>());
  editMode = $state(false);
  showMetadataOverlay = $state(false);

  get selection() {
    return this.#selection;
  }

  set selection(v: Set<string>) {
    this.#selection = new Set(v);
  }

  toggleSelection(id: string) {
    if (this.#selection.has(id)) {
      this.#selection.delete(id);
    } else {
      this.#selection.add(id);
    }
  }

  addSelection(id: string) {
    this.#selection.add(id);
  }

  removeSelection(id: string) {
    this.#selection.delete(id);
  }

  clearSelection() {
    this.#selection.clear();
  }

  setSelection(ids: Set<string>) {
    this.#selection = ids;
  }

  addMultiple(ids: string[]) {
    for (const id of ids) {
      this.#selection.add(id);
    }
  }

  removeMultiple(ids: string[]) {
    for (const id of ids) {
      this.#selection.delete(id);
    }
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    if (!this.editMode) {
      this.clearSelection();
    }
  }

  setEditMode(value: boolean) {
    this.editMode = value;
    if (!value) {
      this.clearSelection();
    }
  }

  setShowMetadataOverlay(value: boolean) {
    this.showMetadataOverlay = value;
  }
}

export const editor = new EditorState();

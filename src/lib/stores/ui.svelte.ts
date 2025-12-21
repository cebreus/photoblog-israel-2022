export class UIState {
  activeTab = $state("agenda");
  sidebarOpen = $state(true);
  curationMode = $state(false);
  photoLabels = $state(false);
  debugMode = $state(false);
  activeSections = $state(new Set<string>());

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  setSidebar(value: boolean) {
    this.sidebarOpen = value;
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }

  setCurationMode(value: boolean) {
    this.curationMode = value;
  }

  /**
   * Centralized logic to determine if curation-specific UI (amber borders, "Compare" buttons)
   * should be visible on a grid item.
   *
   * It's only visible when:
   * 1. Curation mode is enabled.
   * 2. The item actually belongs to a duplicate group.
   * 3. The item is NOT already being displayed inside the curation detail view.
   */
  isCurationVisualsVisible(hasGroup: boolean, mode: string) {
    return this.curationMode && hasGroup && mode !== "curation";
  }

  setPhotoLabels(value: boolean) {
    this.photoLabels = value;
  }

  setDebugMode(value: boolean) {
    this.debugMode = value;
  }

  addSection(id: string) {
    this.activeSections.add(id);
  }

  removeSection(id: string) {
    this.activeSections.delete(id);
  }

  clearSections() {
    this.activeSections.clear();
  }
}

export const ui = new UIState();

declare global {
  interface Window {
    ui_debug: boolean;
  }
}

if (typeof window !== "undefined") {
  $effect.root(() => {
    $effect(() => {
      window.ui_debug = ui.debugMode;
    });
  });
}

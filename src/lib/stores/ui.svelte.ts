export class UIState {
  activeTab = $state("agenda");
  sidebarOpen = $state(true);
  curationMode = $state(false);
  photoLabels = $state(false);
  debug = $state(false);
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

  setPhotoLabels(value: boolean) {
    this.photoLabels = value;
  }

  setDebug(value: boolean) {
    this.debug = value;
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
      window.ui_debug = ui.debug;
    });
  });
}

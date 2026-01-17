function createUIState() {
  let activeTab = $state("agenda");
  let sidebarOpen = $state(true);
  let curationMode = $state(false);
  let photoLabels = $state(false);
  let debugMode = $state(false);
  let activeSections = $state(new Set<string>());
  let peopleAccordionState = $state<string[]>(
    typeof localStorage !== "undefined"
      ? JSON.parse(localStorage.getItem("ui.peopleAccordionState") || '["persons"]')
      : ["persons"],
  );

  // Editing state for inline renaming (persisted across manifest reloads)
  let editingPersonId = $state<string | null>(null);
  let editingName = $state("");

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function setSidebar(value: boolean) {
    sidebarOpen = value;
  }

  function setTab(tab: string) {
    activeTab = tab;
  }

  function setCurationMode(value: boolean) {
    curationMode = value;
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
  function isCurationVisualsVisible(hasGroup: boolean, mode: string) {
    return curationMode && hasGroup && mode !== "curation";
  }

  function setPhotoLabels(value: boolean) {
    photoLabels = value;
  }

  function setDebug(value: boolean) {
    debugMode = value;
  }

  // Backwards-compatible alias; prefer using setDebug
  function setDebugMode(value: boolean) {
    setDebug(value);
  }

  function addSection(id: string) {
    activeSections.add(id);
  }

  function removeSection(id: string) {
    activeSections.delete(id);
  }

  function clearSections() {
    activeSections.clear();
  }

  return {
    get activeTab() {
      return activeTab;
    },
    set activeTab(v) {
      activeTab = v;
    },
    get sidebarOpen() {
      return sidebarOpen;
    },
    set sidebarOpen(v) {
      sidebarOpen = v;
    },
    get curationMode() {
      return curationMode;
    },
    set curationMode(v) {
      curationMode = v;
    },
    get photoLabels() {
      return photoLabels;
    },
    set photoLabels(v) {
      photoLabels = v;
    },
    get debugMode() {
      return debugMode;
    },
    set debugMode(v) {
      debugMode = v;
    },
    get activeSections() {
      return activeSections;
    },
    set activeSections(v) {
      activeSections = v;
    },
    get peopleAccordionState() {
      return peopleAccordionState;
    },
    set peopleAccordionState(v) {
      peopleAccordionState = v;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ui.peopleAccordionState", JSON.stringify(v));
      }
    },
    get editingPersonId() {
      return editingPersonId;
    },
    set editingPersonId(v) {
      editingPersonId = v;
    },
    get editingName() {
      return editingName;
    },
    set editingName(v) {
      editingName = v;
    },
    toggleSidebar,
    setSidebar,
    setTab,
    setCurationMode,
    isCurationVisualsVisible,
    setPhotoLabels,
    setDebug,
    setDebugMode,
    addSection,
    removeSection,
    clearSections,
  };
}

export const ui = createUIState();

declare global {
  interface Window {
    ui_debug: boolean;
  }
}

if (typeof window !== "undefined") {
  $effect.root(function initDebugSync() {
    $effect(function syncDebugMode() {
      window.ui_debug = ui.debugMode;
    });
  });
}

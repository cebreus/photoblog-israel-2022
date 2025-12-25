/**
 * @fileoverview Store Mock Utilities
 *
 * @description
 * Utilities for mocking Svelte 5 runes-based stores in tests.
 * Provides factory functions for creating properly structured mocks.
 *
 * IMPORTANT: These functions should be called BEFORE vi.mock() declarations
 * to avoid hoisting issues with Svelte 5 $state runes.
 */

import type { Person, PhotoDay, QualityBucket } from "../../shared/types/manifest";

/**
 * Default UI store state
 */
export interface MockUIState {
  activeTab: string;
  sidebarOpen: boolean;
  curationMode: boolean;
  photoLabels: boolean;
  debugMode: boolean;
  activeSections: Set<string>;
}

export function createMockUIState(overrides: Partial<MockUIState> = {}): MockUIState {
  return {
    activeTab: "agenda",
    sidebarOpen: true,
    curationMode: false,
    photoLabels: false,
    debugMode: false,
    activeSections: new Set<string>(),
    ...overrides,
  };
}

/**
 * Default editor store state
 */
export interface MockEditorState {
  selection: Set<string>;
  editMode: boolean;
  showMetadataOverlay: boolean;
}

export function createMockEditorState(overrides: Partial<MockEditorState> = {}): MockEditorState {
  return {
    selection: new Set<string>(),
    editMode: false,
    showMetadataOverlay: false,
    ...overrides,
  };
}

/**
 * Default filters store state
 */
export interface MockFiltersState {
  selectedAuthors: string[];
  selectedPeople: string[];
  showSeparators: boolean;
  selectedQualityBuckets: QualityBucket[];
  filtersSyncing: boolean;
}

export function createMockFiltersState(
  overrides: Partial<MockFiltersState> = {},
): MockFiltersState {
  return {
    selectedAuthors: [],
    selectedPeople: [],
    showSeparators: true,
    selectedQualityBuckets: ["excellent", "good", "poor"],
    filtersSyncing: false,
    ...overrides,
  };
}

/**
 * Default people store state
 */
export interface MockPeopleState {
  people: Person[];
  photoDays: PhotoDay[];
  peopleWithStats: Person[];
  visiblePeople: Person[];
  hiddenPeople: Person[];
  categoryPeople: Person[];
  categoryStatues: Person[];
  categoryPaintings: Person[];
  junkPeople: Person[];
}

export function createMockPeopleState(overrides: Partial<MockPeopleState> = {}): MockPeopleState {
  const people = overrides.people || [];
  return {
    people,
    photoDays: overrides.photoDays || [],
    peopleWithStats: overrides.peopleWithStats || people,
    visiblePeople: overrides.visiblePeople || people.filter((p) => !p.hidden && !p.junk),
    hiddenPeople: overrides.hiddenPeople || people.filter((p) => p.hidden && !p.junk),
    categoryPeople:
      overrides.categoryPeople || people.filter((p) => !p.category || p.category === "person"),
    categoryStatues: overrides.categoryStatues || people.filter((p) => p.category === "statue"),
    categoryPaintings:
      overrides.categoryPaintings || people.filter((p) => p.category === "painting"),
    junkPeople: overrides.junkPeople || people.filter((p) => p.junk),
    ...overrides,
  };
}

/**
 * Creates a complete mock for $lib/stores/ui.svelte
 *
 * Usage in test file:
 * ```typescript
 * const mockUI = createMockUIState({ sidebarOpen: false });
 * vi.mock("$lib/stores/ui.svelte", () => ({
 *   ui: mockUI,
 * }));
 * ```
 */
export function createUIStoreMock(state: MockUIState) {
  return {
    ui: {
      get activeTab() {
        return state.activeTab;
      },
      set activeTab(v: string) {
        state.activeTab = v;
      },
      get sidebarOpen() {
        return state.sidebarOpen;
      },
      set sidebarOpen(v: boolean) {
        state.sidebarOpen = v;
      },
      get curationMode() {
        return state.curationMode;
      },
      set curationMode(v: boolean) {
        state.curationMode = v;
      },
      get photoLabels() {
        return state.photoLabels;
      },
      set photoLabels(v: boolean) {
        state.photoLabels = v;
      },
      get debugMode() {
        return state.debugMode;
      },
      set debugMode(v: boolean) {
        state.debugMode = v;
      },
      get activeSections() {
        return state.activeSections;
      },
      toggleSidebar() {
        state.sidebarOpen = !state.sidebarOpen;
      },
      setSidebar(value: boolean) {
        state.sidebarOpen = value;
      },
      setTab(tab: string) {
        state.activeTab = tab;
      },
      clearSections() {
        state.activeSections.clear();
      },
      addSection(id: string) {
        state.activeSections.add(id);
      },
      removeSection(id: string) {
        state.activeSections.delete(id);
      },
    },
  };
}

/**
 * Creates a complete mock for $lib/stores/editor.svelte
 */
export function createEditorStoreMock(state: MockEditorState) {
  return {
    editor: {
      get selection() {
        return state.selection;
      },
      set selection(v: Set<string>) {
        state.selection = v;
      },
      get editMode() {
        return state.editMode;
      },
      set editMode(v: boolean) {
        state.editMode = v;
        if (!v) state.selection = new Set();
      },
      get showMetadataOverlay() {
        return state.showMetadataOverlay;
      },
      set showMetadataOverlay(v: boolean) {
        state.showMetadataOverlay = v;
      },
      toggleSelection(id: string) {
        if (state.selection.has(id)) {
          state.selection.delete(id);
        } else {
          state.selection.add(id);
        }
        state.selection = new Set(state.selection);
      },
      addSelection(id: string) {
        state.selection.add(id);
        state.selection = new Set(state.selection);
      },
      clearSelection() {
        state.selection = new Set();
      },
      setSelection(ids: Set<string>) {
        state.selection = ids;
      },
    },
  };
}

/**
 * Creates a complete mock for $lib/stores/filters.svelte
 */
export function createFiltersStoreMock(state: MockFiltersState) {
  return {
    filters: {
      get selectedAuthors() {
        return state.selectedAuthors;
      },
      set selectedAuthors(v: string[]) {
        state.selectedAuthors = v;
      },
      get selectedPeople() {
        return state.selectedPeople;
      },
      set selectedPeople(v: string[]) {
        state.selectedPeople = v;
      },
      get showSeparators() {
        return state.showSeparators;
      },
      set showSeparators(v: boolean) {
        state.showSeparators = v;
      },
      get selectedQualityBuckets() {
        return state.selectedQualityBuckets;
      },
      set selectedQualityBuckets(v: QualityBucket[]) {
        state.selectedQualityBuckets = v;
      },
      get filtersSyncing() {
        return state.filtersSyncing;
      },
      set filtersSyncing(v: boolean) {
        state.filtersSyncing = v;
      },
    },
  };
}

/**
 * @fileoverview Bidirectional synchronization store for Agenda tab and Map page.
 *
 * @description
 * Provides reactive state and actions for synchronizing interactions between
 * the Agenda sidebar tab and the Map page:
 * - Agenda → Map: Zoom to location on map when clicking in agenda
 * - Map → Agenda: Highlight menu items visible in current map viewport
 * - Hover sync: Bi-directional hover highlighting
 */

/**
 * Svelte 5 reactive store for Agenda-Map synchronization
 */
class AgendaMapSync {
  /** Map location ID selected from Agenda (for zoom trigger) */
  selectedMapLocationId = $state<string | null>(null);

  /** Map location ID currently hovered in Agenda */
  hoveredMapLocationId = $state<string | null>(null);

  /** Set of MenuLocation IDs currently visible in map viewport */
  visibleMenuLocationIds = $state<Set<string>>(new Set());

  /** MenuLocation ID currently hovered on Map */
  hoveredMenuLocationId = $state<string | null>(null);

  /**
   * Trigger zoom to location on map from Agenda
   * Dispatches custom event for map page to handle
   */
  zoomToMapLocation(mapLocationId: string, lat: number, lng: number): void {
    this.selectedMapLocationId = mapLocationId;

    // Emit custom event for Map page
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("agenda:zoom-to-map", {
          detail: { mapLocationId, lat, lng },
        }),
      );
    }
  }

  /**
   * Set hover state for map location from Agenda
   */
  hoverMapLocation(mapLocationId: string | null): void {
    this.hoveredMapLocationId = mapLocationId;
  }

  /**
   * Update set of visible menu locations from map viewport
   */
  setVisibleMenuLocations(menuIds: Set<string>): void {
    this.visibleMenuLocationIds = menuIds;
  }

  /**
   * Set hover state for menu location from Map
   */
  hoverMenuLocation(menuLocationId: string | null): void {
    this.hoveredMenuLocationId = menuLocationId;
  }

  /**
   * Clear all selection state
   */
  clearSelection(): void {
    this.selectedMapLocationId = null;
    this.hoveredMapLocationId = null;
    this.hoveredMenuLocationId = null;
  }
}

export const agendaMapSync = new AgendaMapSync();

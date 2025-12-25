/**
 * @fileoverview Shared Selection Utilities
 *
 * Common selection logic for multi-select with Shift+click support.
 * Used by PhotoGrid, PeopleTab, and other components.
 */

/**
 * Calculates the range of items between two indices (inclusive).
 */
export function getRange<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const [min, max] = [Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex)];
  return items.slice(min, max + 1);
}

/**
 * Finds the index of an item by its ID in a list.
 */
export function findIndexById<T extends { id: string }>(items: T[], id: string): number {
  return items.findIndex((item) => item.id === id);
}

/**
 * Handles shift-click range selection logic.
 *
 * @param currentSelection - Current set of selected IDs
 * @param clickedId - ID of the clicked item
 * @param lastSelectedId - ID of the last selected item (anchor)
 * @param allItems - All items in visual order
 * @param shiftKey - Whether shift was held
 * @returns Object with new selection and updated anchor ID
 */
export function handleShiftClickSelection<T extends { id: string }>(
  currentSelection: Set<string>,
  clickedId: string,
  lastSelectedId: string | null,
  allItems: T[],
  shiftKey: boolean,
): { selection: Set<string>; lastSelected: string | null } {
  if (shiftKey && lastSelectedId) {
    const startIdx = findIndexById(allItems, lastSelectedId);
    const endIdx = findIndexById(allItems, clickedId);

    if (startIdx !== -1 && endIdx !== -1) {
      const range = getRange(allItems, startIdx, endIdx);
      const rangeIds = range.map((item) => item.id);
      const newSelection = new Set(currentSelection);
      for (const id of rangeIds) {
        newSelection.add(id);
      }
      // Don't update lastSelected on shift-click to preserve anchor
      return { selection: newSelection, lastSelected: lastSelectedId };
    }
  }

  // Standard toggle behavior
  const newSelection = new Set(currentSelection);
  if (newSelection.has(clickedId)) {
    newSelection.delete(clickedId);
  } else {
    newSelection.add(clickedId);
  }

  return {
    selection: newSelection,
    lastSelected: shiftKey ? lastSelectedId : clickedId,
  };
}

/**
 * Filters a list by selected IDs.
 */
export function filterBySelection<T extends { id: string }>(
  items: T[],
  selection: Set<string>,
): T[] {
  return items.filter((item) => selection.has(item.id));
}

/**
 * Creates a map of item ID to item for O(1) lookups.
 */
export function createIdMap<T extends { id: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
}

/**
 * Toggles an item in a selection set immutably.
 */
export function toggleInSet(set: Set<string>, id: string): Set<string> {
  const newSet = new Set(set);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  return newSet;
}

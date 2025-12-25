import type { Action } from "svelte/action";
import { ui } from "$lib/stores/ui.svelte";

interface ScrollspyOptions {
  id: string;
  rootMargin?: string;
  threshold?: number | number[];
}

const DEFAULT_ROOT_MARGIN = "-64px 0px 0px 0px";
const DEFAULT_THRESHOLD = 0;

/** Prefix for day sections (e.g., "2022-11-15") */
const DAY_SECTION_PREFIX = /^\d{4}-\d{2}-\d{2}/;
/** Prefix for location sections (e.g., "loc-petra") */
const LOCATION_SECTION_PREFIX = "loc-";

/**
 * Performance optimization: reuse IntersectionObservers that share the same
 * rootMargin + threshold configuration. Each observer keeps a map of nodes
 * -> id so the callback can update the store while only performing a single
 * store update per observer callback (batching), instead of updating for
 * every entry which can hurt performance with many elements.
 */
type ObserverKey = string;
const observerRegistry = new Map<
  ObserverKey,
  {
    observer: IntersectionObserver;
    nodes: Map<Element, string>;
  }
>();

function makeObserverKey(
  rootMargin: string | undefined,
  threshold: number | number[] | undefined,
): ObserverKey {
  const t = Array.isArray(threshold) ? threshold.join(",") : String(threshold);
  return `${rootMargin ?? DEFAULT_ROOT_MARGIN}|${t}`;
}

/**
 * Action to track which section is currently active in the viewport.
 * Updates the `activeSectionIds` store.
 *
 * Uses shared observers for performance.
 */
export const useScrollspy: Action<HTMLElement, ScrollspyOptions> = (node, options) => {
  const { id, rootMargin = DEFAULT_ROOT_MARGIN, threshold = DEFAULT_THRESHOLD } = options;

  if (!id) {
    return { destroy() {} };
  }

  // Use a shared observer (keyed by rootMargin+threshold) to avoid building
  // lots of observers and reduce callback churn. The callback collects all
  // entry changes and does a single activeSectionIds.update per callback to
  // minimize store updates.
  const key = makeObserverKey(rootMargin, threshold);

  let entry = observerRegistry.get(key);

  if (!entry) {
    const nodes = new Map<Element, string>();

    const observer = new IntersectionObserver(
      (entries) => {
        // Batch updates for this callback
        const toAdd: string[] = [];
        const toRemove: string[] = [];

        entries.forEach((e) => {
          const nodeId = nodes.get(e.target);
          if (!nodeId) return;
          if (e.isIntersecting) {
            toAdd.push(nodeId);
          } else {
            toRemove.push(nodeId);
          }
        });

        if (toAdd.length === 0 && toRemove.length === 0) return;

        // Apply all changes in a single store update for better performance
        // IMPORTANT: Process REMOVEs first, then ADDs
        // This ensures that if the same ID leaves and enters in one batch
        // (e.g., scrolling between photo rows of the same location), it stays active
        const current = new Set(ui.activeSections);
        toRemove.forEach((i) => {
          current.delete(i);
        });
        toAdd.forEach((i) => {
          current.add(i);
        });
        ui.activeSections = current;
      },
      { rootMargin, threshold },
    );

    entry = { observer, nodes };
    observerRegistry.set(key, entry);
  }

  // Register this DOM node with the observer
  entry.nodes.set(node, id);
  entry.observer.observe(node);

  return {
    update(_newOptions) {
      // This action assumes options are stable for a given element during its
      // lifecycle in this app. If you need to change id/rootMargin/threshold
      // dynamically, re-initializing (destroy + create) is safer — not done
      // here because per requirements robustness is not desired.
      return;
    },
    destroy() {
      const current = observerRegistry.get(key);
      if (current) {
        current.nodes.delete(node);
        try {
          current.observer.unobserve(node);
        } catch (_err) {
          // Ignore if already removed
        }

        // Clean up the observer if nothing remains
        if (current.nodes.size === 0) {
          current.observer.disconnect();
          observerRegistry.delete(key);
        }
      }
    },
  };
};

/**
 * Returns the "primary" active section ID suitable for URL hash.
 * Priority: first day section found, then first location section.
 * Returns undefined if no sections are active.
 */
export function getPrimaryActiveSection(): string | undefined {
  const sections = ui.activeSections;
  if (sections.size === 0) return undefined;

  // Collect day sections and location sections
  const daySections: string[] = [];
  const locationSections: string[] = [];

  for (const id of sections) {
    if (DAY_SECTION_PREFIX.test(id)) {
      daySections.push(id);
    } else if (id.startsWith(LOCATION_SECTION_PREFIX)) {
      locationSections.push(id);
    }
  }

  // Return the first day section (they're typically added in DOM order)
  // If no day section, return first location section
  return daySections[0] ?? locationSections[0];
}

/**
 * Clears all observers and the registry. Useful for cleanup on navigation.
 */
export function clearAllObservers(): void {
  for (const entry of observerRegistry.values()) {
    entry.observer.disconnect();
    entry.nodes.clear();
  }
  observerRegistry.clear();
  ui.clearSections();
}

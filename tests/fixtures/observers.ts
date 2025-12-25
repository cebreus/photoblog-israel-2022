import { vi } from "vitest";

/**
 * Test utilities for Observer functionality (Intersection, etc.)
 */

export interface MockIntersectionObserverEntry {
  target: Element;
  isIntersecting: boolean;
  intersectionRatio?: number;
}

export interface MockIntersectionObserver {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (entries: MockIntersectionObserverEntry[]) => void;
  cleanup?: () => void;
}

/**
 * Creates a controllable IntersectionObserver mock for testing.
 * This mock replaces the global IntersectionObserver with a proper class.
 */
export function createMockIntersectionObserver(): MockIntersectionObserver {
  let callback: IntersectionObserverCallback | null = null;

  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();

  // Store the original for cleanup
  const OriginalIntersectionObserver = globalThis.IntersectionObserver;

  // Create a proper class that works with `new`
  // This is assigned directly to globalThis, not via vi.spyOn
  globalThis.IntersectionObserver = class MockIntersectionObserver {
    constructor(cb: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
      callback = cb;
    }

    observe(target: Element) {
      observe(target);
    }

    unobserve(target: Element) {
      unobserve(target);
    }

    disconnect() {
      disconnect();
    }

    root = null;
    rootMargin = "";
    thresholds = [0];
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;

  const trigger = (entries: MockIntersectionObserverEntry[]) => {
    if (!callback) {
      throw new Error("IntersectionObserver callback not initialized");
    }

    const fullEntries = entries.map((entry) => ({
      target: entry.target,
      isIntersecting: entry.isIntersecting,
      intersectionRatio: entry.intersectionRatio ?? (entry.isIntersecting ? 1 : 0),
      boundingClientRect: entry.target.getBoundingClientRect(),
      intersectionRect: entry.target.getBoundingClientRect(),
      rootBounds: null,
      time: Date.now(),
    })) as IntersectionObserverEntry[];

    callback(fullEntries, {
      observe,
      unobserve,
      disconnect,
      root: null,
      rootMargin: "",
      thresholds: [0],
      takeRecords: () => [],
    } as unknown as IntersectionObserver);
  };

  const cleanup = () => {
    globalThis.IntersectionObserver = OriginalIntersectionObserver;
  };

  return {
    observe,
    unobserve,
    disconnect,
    trigger,
    cleanup,
  };
}

/**
 * Helper to simulate element intersection
 */
export function simulateIntersection(
  element: Element,
  isIntersecting: boolean,
  intersectionRatio = isIntersecting ? 1 : 0,
): MockIntersectionObserverEntry {
  return {
    target: element,
    isIntersecting,
    intersectionRatio,
  };
}

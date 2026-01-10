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

  // Create a proper constructor function that works with `new`
  function MockIntersectionObserver(
    this: any,
    cb: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    callback = cb;
    this.root = null;
    this.rootMargin = "";
    this.thresholds = [0];
  }

  MockIntersectionObserver.prototype.observe = function observeTarget(target: Element) {
    observe(target);
  };

  MockIntersectionObserver.prototype.unobserve = function unobserveTarget(target: Element) {
    unobserve(target);
  };

  MockIntersectionObserver.prototype.disconnect = function disconnectObserver() {
    disconnect();
  };

  MockIntersectionObserver.prototype.takeRecords = function takeRecordsItems() {
    return [];
  };

  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;

  function trigger(entries: MockIntersectionObserverEntry[]) {
    if (!callback) {
      throw new Error("IntersectionObserver callback not initialized");
    }

    function createFullEntry(entry: MockIntersectionObserverEntry) {
      return {
        target: entry.target,
        isIntersecting: entry.isIntersecting,
        intersectionRatio: entry.intersectionRatio ?? (entry.isIntersecting ? 1 : 0),
        boundingClientRect: entry.target.getBoundingClientRect(),
        intersectionRect: entry.target.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now(),
      };
    }

    const fullEntries = entries.map(createFullEntry) as IntersectionObserverEntry[];

    function takeRecordsMock() {
      return [];
    }

    callback(fullEntries, {
      observe,
      unobserve,
      disconnect,
      root: null,
      rootMargin: "",
      thresholds: [0],
      takeRecords: takeRecordsMock,
    } as unknown as IntersectionObserver);
  }

  function cleanup() {
    globalThis.IntersectionObserver = OriginalIntersectionObserver;
  }

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

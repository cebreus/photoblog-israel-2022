/**
 * @fileoverview IntersectionObserver Test Utilities
 *
 * @description
 * Helpers for testing components that use IntersectionObserver.
 * Works with both jsdom (mocked) and Browser Mode (real).
 */

/**
 * Wait for IntersectionObserver callback to fire.
 * Uses requestAnimationFrame for reliability in browser tests.
 *
 * @param ms - Milliseconds to wait (default: 200)
 */
export async function waitForObserver(ms = 200): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));

  // In browser environment, also wait for next frame
  if (typeof requestAnimationFrame !== "undefined") {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/**
 * Scroll element into view and wait for IntersectionObserver.
 *
 * @param elementId - ID of the element to scroll to
 * @param waitMs - Milliseconds to wait after scrolling (default: 200)
 */
export async function scrollToAndWait(elementId: string, waitMs = 200): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Element #${elementId} not found`);

  el.scrollIntoView({ behavior: "instant", block: "center" });
  await waitForObserver(waitMs);
}

/**
 * Scroll to element using test ID and wait for observer.
 *
 * @param testId - data-testid value
 * @param waitMs - Milliseconds to wait after scrolling (default: 200)
 */
export async function scrollToTestIdAndWait(testId: string, waitMs = 200): Promise<void> {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!el) throw new Error(`Element with data-testid="${testId}" not found`);

  (el as HTMLElement).scrollIntoView({ behavior: "instant", block: "center" });
  await waitForObserver(waitMs);
}

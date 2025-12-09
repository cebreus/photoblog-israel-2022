import { test, expect } from "@playwright/test";

// These e2e tests verify that URL <-> filter slug behaviour works end-to-end.
// They expect the site build to expose authors slugs (e.g. `cebreus`) from the
// server-provided `data.authors` list. The test uses the UI testids added to the
// filters offcanvas so it can assert switch state and that the URL updates with
// slug CSV values.

const FILTER_TRIGGER = '[data-testid="filters-offcanvas-trigger"]';
const SWITCH_PREFIX = "filters-author-switch-";

// Helper to make a fully qualified selector from a slug
function switchSelectorFor(slug: string) {
  return `[data-testid="${SWITCH_PREFIX}${slug}"]`;
}

test("authors=csv initializes filter using slugs", async ({ page }) => {
  // pick a likely existing slug — the generator uses the canonical author
  // 'Cebreus' in the manifest; slug is 'cebreus'
  const testSlug = "cebreus";
  await page.goto(`/?authors=${encodeURIComponent(testSlug)}`);

  // open the filters and check the corresponding author switch is checked
  await page.click(FILTER_TRIGGER);
  const sw = page.locator(switchSelectorFor(testSlug));
  await expect(sw).toBeVisible();
  // The control is a custom Switch component — Playwright's `toHaveAttribute` can
  // verify checked presence when a `data-checked` or aria attributes exist.
  // However the simplest is to check it is visually toggled (using getAttribute)
  // We assert it exists then toggle it to ensure URL changes use slugs.

  // Confirm the switch is initially checked
  expect(await sw.getAttribute("aria-checked")).toBe("true");
});

test("toggling author switch updates URL using slugs", async ({ page }) => {
  const testSlug = "cebreus";
  await page.goto("/");

  await page.click(FILTER_TRIGGER);
  const sw = page.locator(switchSelectorFor(testSlug));
  await expect(sw).toBeVisible();

  // Ensure switching off removes the slug from the URL
  // Note: the app debounces writes (300ms) — wait slightly longer than that
  const initialChecked = await sw.getAttribute("aria-checked");
  // click to toggle
  await sw.click();
  await page.waitForTimeout(500);
  const afterChecked = await sw.getAttribute("aria-checked");
  const urlAfter = page.url();

  // After toggling, URL must reflect the new state (authors CSV uses slugs)
  if (afterChecked === "true") {
    expect(urlAfter.includes(`authors=${testSlug}`)).toBe(true);
  } else {
    expect(urlAfter.includes(`authors=${testSlug}`)).toBe(false);
  }
});

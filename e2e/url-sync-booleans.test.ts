import { test, expect } from "@playwright/test";

/**
 * E2E tests verifying URL boolean parameter behavior:
 * - Boolean params use strict "true"/"false" format (not "1"/"0")
 * - Legacy numeric values get normalized to boolean strings
 * - URL params survive navigation and UI interactions
 * - All boolean param types (separators, labels, editMode, debug) work consistently
 */

const FILTER_TRIGGER = '[data-testid="header-sidebar-trigger"]';

test.describe("URL boolean synchronization", () => {
  test("boolean params persist with true/false values", async ({ page }) => {
    await page.goto("/?separators=true&labels=false");
    await page.waitForLoadState("networkidle");

    const url = new URL(page.url());

    // Verify params maintain exact boolean values set in URL
    expect(url.searchParams.get("separators")).toBe("true");
    expect(url.searchParams.get("labels")).toBe("false");
  });

  test("all boolean param types work correctly", async ({ page }) => {
    await page.goto("/?separators=false&labels=true&editMode=false&debug=true");
    await page.waitForLoadState("networkidle");

    const url = new URL(page.url());

    // Verify all 4 boolean param types are handled consistently
    expect(url.searchParams.get("separators")).toBe("false");
    expect(url.searchParams.get("labels")).toBe("true");
    expect(url.searchParams.get("editMode")).toBe("false");
    expect(url.searchParams.get("debug")).toBe("true");
  });

  test("old numeric values (1/0) are normalized to true/false", async ({
    page,
  }) => {
    // Navigate with legacy numeric params
    await page.goto("/?separators=1&labels=0");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const url = new URL(page.url());

    // parseBooleanParam returns undefined for "1"/"0", so stores keep defaults
    // syncUrlFromFilters then writes current store values as true/false
    const separatorsParam = url.searchParams.get("separators");
    const labelsParam = url.searchParams.get("labels");

    expect(separatorsParam).toMatch(/^(true|false)$/);
    expect(labelsParam).toMatch(/^(true|false)$/);
  });

  test("params survive UI interaction", async ({ page }) => {
    await page.goto("/?separators=false&labels=true");

    // Trigger UI interaction that could potentially reset params
    await page.click(FILTER_TRIGGER);
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    const url = new URL(page.url());

    // Values should remain unchanged after UI interaction
    expect(url.searchParams.get("separators")).toBe("false");
    expect(url.searchParams.get("labels")).toBe("true");
  });
});

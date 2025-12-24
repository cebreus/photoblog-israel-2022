import { expect, test } from "@playwright/test";

test.describe("Edit Mode - Multi-select", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate with edit mode enabled via URL parameter
    await page.goto("/?editMode", { timeout: 60000 });
    await page.waitForLoadState("networkidle");

    // Wait for edit mode to be active (grid items visible)
    const firstItem = page.locator("[data-testid^='photo-grid-item-checkbox-']").first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });
  });

  test("selects range of images with Shift+Click", async ({ page }) => {
    // Wait for grid to be loaded
    const overlays = page.locator("[data-testid^='photo-grid-item-overlay-']");
    await overlays.first().waitFor({ state: "visible" });

    // Get first 5 image overlays
    const firstOverlay = overlays.nth(0);
    const secondOverlay = overlays.nth(1);
    const thirdOverlay = overlays.nth(2);
    const fourthOverlay = overlays.nth(3);

    // Click first image to select it
    await firstOverlay.click();

    // Verify first image is selected (blue border)
    const firstParent = firstOverlay.locator("..");
    await expect(firstParent).toHaveClass(/border-blue-500/);

    // Shift+Click third image
    await thirdOverlay.click({ modifiers: ["Shift"] });

    // Verify all three images (1, 2, 3) are now selected
    const selectedBorders = page.locator(".border-blue-500");
    expect(await selectedBorders.count()).toBe(3);

    // Verify images 1, 2, 3 have selection
    await expect(firstOverlay.locator("..")).toHaveClass(/border-blue-500/);
    await expect(secondOverlay.locator("..")).toHaveClass(/border-blue-500/);
    await expect(thirdOverlay.locator("..")).toHaveClass(/border-blue-500/);

    // Verify image 4 is NOT selected
    await expect(fourthOverlay.locator("..")).not.toHaveClass(/border-blue-500/);
  });

  test("Shift+Click works in reverse direction", async ({ page }) => {
    const overlays = page.locator("[data-testid^='photo-grid-item-overlay-']");
    await overlays.first().waitFor({ state: "visible" });

    // Click third image first
    const thirdId = await overlays.nth(2).getAttribute("data-testid");
    const imageId3 = thirdId?.replace("photo-grid-item-overlay-", "");
    await overlays.nth(2).click();
    await expect(
      page.locator(`[data-testid='photo-grid-item-selection-indicator-${imageId3}']`),
    ).toBeVisible();

    // Shift+Click first image (reverse direction)
    await overlays.nth(0).click({ modifiers: ["Shift"] });

    // Should still select images 1, 2, 3
    const selectionIndicators = page.locator(
      "[data-testid^='photo-grid-item-selection-indicator-']",
    );
    expect(await selectionIndicators.count()).toBe(3);
  });

  test("Shift+Click extends selection, regular click toggles", async ({ page }) => {
    const overlays = page.locator("[data-testid^='photo-grid-item-overlay-']");
    await overlays.first().waitFor({ state: "visible" });

    // Select first image
    await overlays.nth(0).click();
    expect(
      await page.locator("[data-testid^='photo-grid-item-selection-indicator-']").count(),
    ).toBe(1);

    // Shift+Click third to select range 1-3
    await overlays.nth(2).click({ modifiers: ["Shift"] });
    expect(
      await page.locator("[data-testid^='photo-grid-item-selection-indicator-']").count(),
    ).toBe(3);

    // Regular click on second image should deselect it
    await overlays.nth(1).click();
    expect(
      await page.locator("[data-testid^='photo-grid-item-selection-indicator-']").count(),
    ).toBe(2);
  });

  test("preserves anchor point for multiple Shift+Click operations", async ({ page }) => {
    const overlays = page.locator("[data-testid^='photo-grid-item-overlay-']");
    await overlays.first().waitFor({ state: "visible" });

    // Click image 2 as anchor
    await overlays.nth(1).click();

    // Shift+Click image 4 (should select 2, 3, 4)
    await overlays.nth(3).click({ modifiers: ["Shift"] });
    expect(
      await page.locator("[data-testid^='photo-grid-item-selection-indicator-']").count(),
    ).toBe(3);

    // Another Shift+Click on image 6 (should select from anchor 2 to 6: 2,3,4,5,6)
    await overlays.nth(5).click({ modifiers: ["Shift"] });
    expect(
      await page.locator("[data-testid^='photo-grid-item-selection-indicator-']").count(),
    ).toBe(5);
  });
});

import { expect, test } from "@playwright/test";

test.describe("Collage Editor - E2E", function () {
  test.beforeEach(async function ({ page }) {
    await page.goto("/");
    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("creates new collage from selected images", async function ({ page }) {
    // Enter edit mode
    await page.getByTestId("edit-mode-toggle").click();

    // Select 2 images using Shift+click
    await page.getByTestId("photo-grid-item").first().click();
    await page.keyboard.down("Shift");
    await page.getByTestId("photo-grid-item").nth(1).click();
    await page.keyboard.up("Shift");

    // Open collage dialog
    await page.getByText("Vytvořit koláž").click();

    // Verify dialog opened (check for elements that exist outside portal)
    await expect(page.locator("[data-testid='collage-preview-area']")).toBeVisible({
      timeout: 5000,
    });

    // Select template
    await page.getByTestId("collage-template-row").click();

    // Select aspect ratio
    await page.getByTestId("collage-ratio-16-9").click();

    // Wait for popup before clicking generate
    const popupPromise = page.waitForEvent("popup");

    // Generate collage
    await page.getByTestId("collage-create-button").click();

    // Wait for success message
    await expect(page.getByText(/Koláž vytvořena/)).toBeVisible({
      timeout: 15000,
    });

    // Verify new tab opened
    const newPage = await popupPromise;
    expect(newPage.url()).toContain("--collage");
  });

  test("re-edits existing collage", async function ({ page }) {
    // Enter edit mode
    await page.getByTestId("edit-mode-toggle").click();

    // Find and select a collage image (if exists)
    const collageImage = page.locator("[alt*='--collage']").first();

    const hasCollage = await collageImage.isVisible().catch(function () {
      return false;
    });

    test.skip(!hasCollage, "No existing collage to re-edit");

    await collageImage.click();

    // Click edit collage button
    await page.getByText("Upravit koláž").click();

    // Verify dialog shows existing settings
    await expect(page.getByTestId("collage-preview-area")).toBeVisible();
  });

  test("changes aspect ratio and template", async function ({ page }) {
    // Enter edit mode
    await page.getByTestId("edit-mode-toggle").click();

    // Select images
    await page.getByTestId("photo-grid-item").first().click();
    await page.keyboard.down("Shift");
    await page.getByTestId("photo-grid-item").nth(1).click();
    await page.keyboard.up("Shift");

    // Open dialog
    await page.getByText("Vytvořit koláž").click();

    await expect(page.getByTestId("collage-preview-area")).toBeVisible();

    // Change to column template
    await page.getByTestId("collage-template-column").click();

    // Change aspect ratio
    await page.getByTestId("collage-ratio-21-9").click();

    // Close dialog without saving
    await page.keyboard.press("Escape");
  });

  test("adjusts border settings", async function ({ page }) {
    // Enter edit mode
    await page.getByTestId("edit-mode-toggle").click();

    // Select images
    await page.getByTestId("photo-grid-item").first().click();
    await page.keyboard.down("Shift");
    await page.getByTestId("photo-grid-item").nth(1).click();
    await page.keyboard.up("Shift");

    // Open dialog
    await page.getByText("Vytvořit koláž").click();

    await expect(page.getByTestId("collage-settings")).toBeVisible();

    // Toggle border off
    await page.getByTestId("collage-border-toggle").click();

    // Change border width
    await page.getByTestId("collage-border-width-input").fill("20");

    // Change border color
    await page.getByTestId("collage-border-color-input").fill("#000000");

    // Close dialog
    await page.keyboard.press("Escape");
  });

  test("handles image reordering", async function ({ page }) {
    // Enter edit mode
    await page.getByTestId("edit-mode-toggle").click();

    // Select 3 images for better reordering test
    await page.getByTestId("photo-grid-item").first().click();
    await page.keyboard.down("Shift");
    await page.getByTestId("photo-grid-item").nth(1).click();
    await page.getByTestId("photo-grid-item").nth(2).click();
    await page.keyboard.up("Shift");

    // Open dialog
    await page.getByText("Vytvořit koláž").click();

    await expect(page.getByTestId("collage-images-list")).toBeVisible();

    // Get first image ID
    const firstItem = page.locator("[data-testid^='collage-image-item-']").first();
    const firstItemId = await firstItem.getAttribute("data-testid");

    // Click move down on first image
    const moveDownBtn = page.locator(`[data-testid^='collage-move-down-']`).first();
    await moveDownBtn.click();

    // Verify order changed (first item should no longer be first)
    const newFirstItem = page.locator("[data-testid^='collage-image-item-']").first();
    const newFirstItemId = await newFirstItem.getAttribute("data-testid");

    expect(newFirstItemId).not.toBe(firstItemId);

    // Close dialog
    await page.keyboard.press("Escape");
  });
});

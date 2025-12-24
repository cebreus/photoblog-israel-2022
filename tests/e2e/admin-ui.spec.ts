import { expect, test } from "@playwright/test";

// Mark as serial because these tests modify state (archive/delete)
test.describe.configure({ mode: "serial" });

test.describe("Admin UI Actions", () => {
  // Context menu tests - improved reliability with better waits

  test.beforeEach(async ({ page }) => {
    // Navigate with edit mode enabled via URL parameter
    await page.goto("/?editMode", { timeout: 60000 });
    await page.waitForLoadState("networkidle");
    const firstCheckbox = page.locator("[data-testid^='photo-grid-item-checkbox-']").first();
    await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
  });

  test("context menu appears on right click", async ({ page }) => {
    const firstPhoto = page.locator("[data-testid='photo-grid-item']").first();
    await firstPhoto.waitFor({ state: "visible" });

    // Force click to ensure we hit the trigger even if overlay matches
    await firstPhoto.click({ button: "right", force: true });

    const menu = page.locator("[data-testid='photo-grid-item-contextmenu-copy-metadata']");
    await expect(menu).toBeVisible({ timeout: 3000 });
  });

  test("can open archive dialog", async ({ page }) => {
    const firstPhoto = page.locator("[data-testid='photo-grid-item']").first();
    await firstPhoto.waitFor({ state: "visible" });
    await firstPhoto.click({ button: "right", force: true });

    const archiveBtn = page.locator("[data-testid='photo-grid-item-contextmenu-archive-image']");
    await archiveBtn.click();

    // Check for dialog/confirmation
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Archivovat fotky?")).toBeVisible();

    // Verify confirm button is present
    const confirmBtn = page.locator("[data-testid='archive-image-dialog-confirm']");
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();

    // Close dialog
    await page.getByRole("button", { name: "Zrušit" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

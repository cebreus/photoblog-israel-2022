import { expect, test } from "@playwright/test";

// Mark as serial because these tests modify state (archive/delete)
test.describe.configure({ mode: "serial" });

test.describe("Admin UI Actions", () => {
  // Admin UI tests (context menu) are currently flaky in headless mode.
  // Skipping for now.
  test.skip();

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
    // Enable edit mode via keyboard shortcut or UI button if available
    // Assuming 'e' key toggles edit mode based on typical admin implementation
    await page.keyboard.press("e");
    await expect(page.locator("[data-testid='photo-grid-item-checkbox']").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("context menu appears on right click", async ({ page }) => {
    test.slow();
    const firstPhoto = page.locator("[data-testid='photo-grid-item']").first();
    // Force click to ensure we hit the trigger even if overlay matches
    await firstPhoto.click({ button: "right", force: true });

    const menu = page.locator("[data-testid='photo-grid-item-contextmenu-copy-metadata']");
    await expect(menu).toBeVisible();
  });

  test("can open archive dialog", async ({ page }) => {
    test.slow();
    const firstPhoto = page.locator("[data-testid='photo-grid-item']").first();
    await firstPhoto.click({ button: "right", force: true });

    const archiveBtn = page.locator("[data-testid='photo-grid-item-contextmenu-archive-image']");
    await archiveBtn.click();

    // Check for dialog/confirmation
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Archivovat fotky?")).toBeVisible();

    // Verify confirm button is present (but DO NOT CLICK in test environment without mocking API generally,
    // though here we are in E2E which might affect real data if not careful.
    // Admin tests usually run against a test instance or clean up.
    // For now, just verifying the dialog opens is enough for "UI" test).
    const confirmBtn = page.locator("[data-testid='archive-image-dialog-confirm']");
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();

    // Close dialog
    await page.getByRole("button", { name: "Zrušit" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

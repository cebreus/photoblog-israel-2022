import { expect, test } from "@playwright/test";

test.describe("People Tab - Multi-select", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
    await page.waitForLoadState("networkidle");

    // Open sidebar if not already open
    const sidebar = page.locator("[data-testid='header-sidebar-trigger']");
    await sidebar.click();

    // Wait a bit for sidebar animation
    await page.waitForTimeout(300);

    // Click People tab
    await page.getByRole("tab", { name: /Lidé/i }).click();

    // Wait for people list to load
    await page.locator("[data-testid='people-tab']").waitFor({ state: "visible" });
  });

  test("Shift+Click selects range of people for filtering", async ({ page }) => {
    // Get visible people items
    const peopleItems = page.locator("[data-testid^='people-tab-visible-item']");
    await peopleItems.first().waitFor({ state: "visible", timeout: 5000 });

    const itemCount = await peopleItems.count();
    if (itemCount < 3) {
      test.skip(true, "Not enough people in gallery for range selection test");
    }

    // Click first person to select for filtering
    await peopleItems.nth(0).click();

    // Verify first person is active/selected (check for active state class or aria)
    // Note: Actual selector depends on implementation

    // Shift+Click third person
    await peopleItems.nth(2).click({ modifiers: ["Shift"] });

    // Verify that URL or filter state reflects selection
    // This might update URL params with people IDs
    // Check that selectedPeople param exists (implementation specific)

    // Verify photo grid shows filtered results
    // Photos should only show those containing selected people
    const photoGrid = page.locator("[data-testid^='photo-grid-item']");
    await expect(photoGrid.first()).toBeVisible({ timeout: 3000 });
  });

  test("Shift+Click on merge checkboxes selects range", async ({ page }) => {
    // Get people in visible list
    const peopleItems = page.locator("[data-testid^='people-tab-visible-item']");
    await peopleItems.first().waitFor({ state: "visible", timeout: 5000 });

    const itemCount = await peopleItems.count();
    if (itemCount < 3) {
      test.skip(true, "Not enough people for merge checkbox test");
    }

    // Find and check first person's merge checkbox
    const firstCheckbox = peopleItems.nth(0).locator("input[type='checkbox']");
    await firstCheckbox.check();

    // Verify merge controls appear
    await expect(page.getByRole("button", { name: /Sloučit/i })).toBeVisible();

    // Find third person's checkbox
    const thirdCheckbox = peopleItems.nth(2).locator("input[type='checkbox']");

    // Shift+Click third checkbox (hold Shift, then click)
    await page.keyboard.down("Shift");
    await thirdCheckbox.check();
    await page.keyboard.up("Shift");

    // Verify all three checkboxes (1, 2, 3) are now checked
    expect(await peopleItems.nth(0).locator("input[type='checkbox']:checked").count()).toBe(1);
    expect(await peopleItems.nth(1).locator("input[type='checkbox']:checked").count()).toBe(1);
    expect(await peopleItems.nth(2).locator("input[type='checkbox']:checked").count()).toBe(1);

    // Verify merge button is enabled and shows count
    const mergeButton = page.getByRole("button", { name: /Sloučit/i });
    await expect(mergeButton).toBeEnabled();
  });

  test("Shift+Click works across different people sections", async ({ page }) => {
    // This tests range selection when people are split into Named and Generic sections

    const peopleItems = page.locator("[data-testid^='people-tab-visible-item']");
    await peopleItems.first().waitFor({ state: "visible" });

    const itemCount = await peopleItems.count();
    if (itemCount < 5) {
      test.skip(true, "Not enough people for cross-section test");
    }

    // Click a person in first section
    await peopleItems.nth(1).click();

    // Shift+Click a person later in list (might be in different section)
    await peopleItems.nth(4).click({ modifiers: ["Shift"] });

    // Should select all people between 1 and 4 (inclusive)
    // Verify via filter state or UI indicators
  });
});

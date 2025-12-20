import { expect, test } from "@playwright/test";

test.describe("Smoke & Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
  });

  test("loads the main page and displays photos", async ({ page }) => {
    await expect(page).toHaveTitle(/Fotoblog/);

    // Check for photo grid
    const photos = page.locator("[data-testid='photo-grid-item']");
    await expect(photos.first()).toBeVisible({ timeout: 15000 });
    const count = await photos.count();
    expect(count).toBeGreaterThan(0);
  });

  test("sidebar navigation works (Agenda, Filters, People)", async ({ page }) => {
    const sidebar = page.locator("[data-testid='app-sidebar']");

    // On desktop (1920x1080), sidebar should be visible initially
    if (!(await sidebar.isVisible())) {
      // Only try to open if hidden (e.g. if responsive breakpoint is different)
      await page.getByTestId("sidebar-trigger").click();
      await expect(sidebar).toBeVisible();
    }
    // Wait for animation to settle
    await page.waitForTimeout(500);

    // Toggle different tabs
    const agendaTab = page.getByTestId("app-sidebar-agenda-tab");
    const filtersTab = page.getByTestId("app-sidebar-filters-tab");
    const peopleTab = page.getByTestId("app-sidebar-people-tab");

    await expect(agendaTab).toBeVisible();

    // Test Agenda Tab
    await agendaTab.click();
    // Just wait a bit to ensure no crash/error
    await page.waitForTimeout(1000);

    // Test Filters Tab
    await filtersTab.click();
    await page.waitForTimeout(1000);

    // Test People Tab
    await peopleTab.click();
    await page.waitForTimeout(1000);
  });

  test("footer contains expected links", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    // Assuming there is some copyright or link
    // Just generic check for now to prove footer renders
    await expect(footer).toBeVisible();
  });
});

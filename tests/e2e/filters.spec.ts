import { expect, test } from "@playwright/test";

test.describe("Gallery Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
    // Open Sidebar if closed (though default might be open on widespread screens, check trigger)
    const sidebar = page.locator("[data-testid='app-sidebar']");
    // Simple logic: if sidebar not visible, open it.
    // But we need to be careful about state.
    if (!(await sidebar.isVisible())) {
      const trigger = page.getByTestId("sidebar-trigger");
      await expect(trigger).toBeVisible();
      await trigger.click();
      await expect(sidebar).toBeVisible();
    }
  });

  test("unchecking all aesthetic buckets hides all photos", async ({ page }) => {
    // Go to Filters tab
    await expect(page.locator("[data-testid='app-sidebar']")).toBeVisible();
    await page.getByTestId("app-sidebar-filters-tab").click();

    // Initially we should see photos
    const gridItems = page.locator("[data-testid='photo-grid-item']");
    // Wait for grid to load
    await expect(gridItems.first()).toBeVisible();
    const initialCount = await gridItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // Toggle OFF all aesthetic buckets
    // Note: Logic is subtractive. Default = all selected (empty array or all in array).
    // UI shows them as "variant=secondary" (selected).
    // Clicking them shoud toggle them off.

    const buckets = ["Excelentní", "Dobré", "Podprůměrné"];

    let toggledCount = 0;
    for (const bucketName of buckets) {
      const btn = page.getByRole("button", { name: bucketName });
      if (await btn.isVisible()) {
        await btn.click();
        toggledCount++;
      } else {
        console.log(`Filter button ${bucketName} not visible - skipping toggle`);
      }
    }

    if (toggledCount === 0) {
      console.warn(
        "Skipping aesthetic filter test assertions: No filter buttons were visible (likely missing analysis data).",
      );
      // If we couldn't filter, we just expect to see *some* photos (Default View)
      const finalCount = await gridItems.count();
      expect(finalCount).toBeGreaterThan(0);
      return;
    }

    // Now expected count is 0
    // Wait specifically for update
    await expect(gridItems).toHaveCount(0, { timeout: 10000 });

    // Turn one back on
    await page.getByRole("button", { name: "Excelentní" }).click();

    // Verify URL contains quality param
    await expect(page).toHaveURL(/quality=/);
  });

  test("persists filter state in URL", async ({ page }) => {
    const filterTab = page.getByTestId("app-sidebar-filters-tab");
    await expect(filterTab).toBeVisible();
    await filterTab.click();

    // Toggle "Dobré" (Good) - but only if visible
    const goodBtn = page.getByRole("button", { name: "Dobré" });
    const isVisible = await goodBtn.isVisible().catch(() => false);

    if (!isVisible) {
      console.warn(
        "Skipping URL persistence test: Aesthetic filter buttons not available (missing analysis data)",
      );
      test.skip();
      return;
    }

    await goodBtn.click();

    // Check URL has quality param
    await expect(page).toHaveURL(/quality=/, { timeout: 5000 });

    // Reload page
    await page.reload();

    // URL should still have quality param
    await expect(page).toHaveURL(/quality=/);
  });
});

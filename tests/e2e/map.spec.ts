import { expect, test } from "@playwright/test";

test.describe("Map Functionality", function () {
  test("displays map with data and handles markers/clustering", async function ({ page }) {
    // Navigate to map page
    await page.goto("/map", { timeout: 60000 });

    // Verify map container is visible
    const map = page.locator("[data-testid='leaflet-map']");
    await expect(map).toBeVisible();

    // Wait for loading to complete
    const loadingOverlay = page.locator("[data-testid='map-loading']");
    if (await loadingOverlay.isVisible()) {
      await expect(loadingOverlay).not.toBeVisible({ timeout: 15000 });
    }

    // Verify no error state
    const errorMessage = page.locator("[data-testid='map-error']");
    await expect(errorMessage).not.toBeVisible();

    // Verify Leaflet is initialized
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // Check for either cluster OR custom markers
    const markersAndClusters = page.locator(".marker-cluster, .marker-wrapper");
    const count = await markersAndClusters.count();

    // If there are GPS-tagged photos in the manifest, we should see markers
    if (count > 0) {
      await expect(markersAndClusters.first()).toBeVisible({ timeout: 10000 });

      // If we have markers, try clicking one to open Fancybox
      const customMarkers = page.locator(".marker-wrapper");
      if ((await customMarkers.count()) > 0) {
        await customMarkers.first().click({ force: true });
        await expect(page.locator(".fancybox__container")).toBeVisible();
      } else {
        // If we only see clusters, click a cluster to zoom in
        await page.locator(".marker-cluster").first().click();
        await expect(customMarkers.first()).toBeVisible({ timeout: 5000 });
        await customMarkers.first().click({ force: true });
        await expect(page.locator(".fancybox__container")).toBeVisible();
      }
    } else {
      // No GPS data - this is OK for galleries without location metadata
      console.log("No GPS-tagged photos found in manifest - test passed with empty map");
    }
  });
});

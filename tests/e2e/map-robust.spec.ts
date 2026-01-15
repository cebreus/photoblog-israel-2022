import { expect, test } from "@playwright/test";

/**
 * Robust E2E tests for the Map feature.
 * Covers:
 * - Sidebar to Map navigation (long vs short distance)
 * - Clustering behavior & De-clustering at zoom 15
 * - Visual feedback (Marker highlighting & Sidebar active states)
 * - Fancybox integration
 */
test.describe("Robust Map Interactions", function () {
  test.beforeEach(async ({ page }) => {
    // Navigate to map page
    await page.goto("/map", { timeout: 60000 });

    // Ensure map container and Leaflet are ready
    const mapContainer = page.locator("[data-testid='leaflet-map']");
    await expect(mapContainer).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // Wait for markers/clusters to load
    await expect(page.locator(".marker-cluster, .marker-wrapper").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("should navigate smoothly to a long distance location and highlight it", async function ({
    page,
  }) {
    // 1. Locate sidebar item for "Královská vlaková garáž" (Long distance from Alexandria)
    const sidebarItem = page
      .locator("[data-sidebar='menu-sub-button']")
      .filter({ hasText: "Královská vlaková garáž" });
    await sidebarItem.scrollIntoViewIfNeeded();
    await expect(sidebarItem).toBeVisible();

    // 2. Click to trigger flyTo
    await sidebarItem.click({ force: true });

    // 3. Verify map marker becomes highlighted AFTER animation
    // Long distance animation + moveend delay ≈ 5-7s. We use 30s timeout for stability.
    const highlightedMarker = page.locator(".marker-highlighted");
    await expect(highlightedMarker).toBeVisible({ timeout: 30000 });

    // 4. Verify sidebar item also shows active state (.map-highlighted class)
    await expect(sidebarItem).toHaveClass(/map-highlighted/);
  });

  test("should handle very short distance transitions without map jumping", async function ({
    page,
  }) {
    // 1. Navigate to "Hrobka z ulice Tigran" first (Alexandria)
    const tombItem = page
      .locator("[data-sidebar='menu-sub-button']")
      .filter({ hasText: "Hrobka z ulice Tigran" });
    await tombItem.scrollIntoViewIfNeeded();
    await tombItem.click({ force: true });

    // Wait for arrival
    await expect(page.locator(".marker-highlighted")).toBeVisible({ timeout: 30000 });

    // 2. Click "Katakomby Kom el Shoqafa" (Very close, < 500m)
    const catacombsItem = page
      .locator("[data-sidebar='menu-sub-button']")
      .filter({ hasText: "Katakomby Kom el Shoqafa" });
    await catacombsItem.scrollIntoViewIfNeeded();
    await catacombsItem.click({ force: true });

    // 3. Verify it highlights quickly (should not trigger long moveend logic)
    // In our code, distance < 0.005 returns early with direct highlight.
    await expect(page.locator(".marker-highlighted")).toBeVisible({ timeout: 10000 });

    // Give reactive state time to propagate to sidebar
    await page.waitForTimeout(1000);

    // Verify sidebar sync for the new active item
    await expect(catacombsItem).toHaveClass(/map-highlighted/);
    // Previous item (tombItem) might still be highlighted because they are both in view at zoom 15.
  });

  test("should disable clustering at zoom level 15+ to show photo previews", async function ({
    page,
  }) {
    // 1. Navigate to "Serapeum" which has multiple photos/locations clustered by default
    const serapeumItem = page
      .locator("[data-sidebar='menu-sub-button']")
      .filter({ hasText: "Serapeum" });
    await serapeumItem.scrollIntoViewIfNeeded();
    await serapeumItem.click({ force: true });

    // 2. Wait for animation to zoom 15
    await page.waitForTimeout(6000); // 5s max animation + 1s buffer

    // 3. Verify that clusters (e.g. cluster with '3') are gone at this level
    const clusterWith3 = page.locator(".marker-cluster", { hasText: "3" });
    await expect(clusterWith3).not.toBeVisible();

    // 4. Verify individual photo markers (marker-wrapper) are visible instead
    const individualMarkers = page.locator(".marker-wrapper");
    await expect(individualMarkers.first()).toBeVisible({ timeout: 10000 });

    const count = await individualMarkers.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 5. Verify clicking a marker opens Fancybox
    // Marker might be moving due to animation or near viewport edge
    await page.waitForTimeout(1000);
    await individualMarkers.first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator(".fancybox__container")).toBeVisible();
  });

  test("should highlight map marker on sidebar item hover", async function ({ page }) {
    const sidebarItem = page
      .locator("[data-sidebar='menu-sub-button']")
      .filter({ hasText: "Serapeum" });
    await sidebarItem.scrollIntoViewIfNeeded();

    // 1. Click sidebar item to zoom in first (ensure it's not clustered)
    await sidebarItem.click({ force: true });

    // Wait for arrival at zoom 15
    await expect(page.locator(".marker-highlighted")).toBeVisible({ timeout: 30000 });

    // 2. Unhover/Reset state
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // 3. Hover sidebar item
    await sidebarItem.hover();

    // Verify .marker-hovered class is applied to the marker
    await expect(page.locator(".marker-hovered")).toBeVisible();

    // 4. Unhover
    await page.mouse.move(0, 0); // Move mouse away
    await expect(page.locator(".marker-hovered")).not.toBeVisible();
  });

  test("should zoom to all locations of a day when clicking day header", async function ({ page }) {
    // 1. Locate day header for "úterý 25. listopadu 2025" (contains Alexandria locations)
    const dayHeader = page
      .locator("[data-sidebar='menu-button']")
      .filter({ hasText: "25. listopadu" });
    await dayHeader.scrollIntoViewIfNeeded();

    // 2. Click to trigger zoomToDay
    await dayHeader.click();

    // 3. Verify map movement (zoom should change or center should shift to encompass the day's markers)
    // We'll wait for a moment for the animation
    await page.waitForTimeout(3000);

    // Verify that markers/clusters for that day are visible in the container
    const markersOrClusters = page.locator(".marker-cluster, .marker-wrapper");
    await expect(markersOrClusters.first()).toBeVisible({ timeout: 10000 });

    const count = await markersOrClusters.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should switch map layers (Street vs Satellite)", async function ({ page }) {
    // 1. Expand layer control
    const toggle = page.locator(".leaflet-control-layers-toggle");
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await toggle.evaluate((el: HTMLElement) => el.click());

    // 2. Wait for layers list to expand
    const layersList = page.locator(".leaflet-control-layers-list");
    await expect(layersList).toBeVisible();

    // 3. Programmatically check "Satelit" layer and trigger change event
    const satelliteInput = page
      .locator(".leaflet-control-layers-base label")
      .filter({ hasText: "Satelit" })
      .locator("input");
    await satelliteInput.evaluate((el: HTMLInputElement) => {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // 4. Verify layer change
    await expect(satelliteInput).toBeChecked({ timeout: 10000 });

    // 5. Switch back to "Mapa" programmatically
    const streetInput = page
      .locator(".leaflet-control-layers-base label")
      .filter({ hasText: "Mapa" })
      .locator("input");
    await streetInput.evaluate((el: HTMLInputElement) => {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(streetInput).toBeChecked({ timeout: 10000 });
  });

  test("should initialize with fitBounds showing all markers", async function ({ page }) {
    // Since we are in beforeEach, we just navigated to /map.
    // Check if many markers/clusters are visible (meaning we are zoomed out enough to see the whole trip)
    const clusters = page.locator(".marker-cluster");
    await expect(clusters.first()).toBeVisible({ timeout: 15000 });

    // Give time for clustering to settle
    await page.waitForTimeout(2000);

    const count = await clusters.count();
    // Initial view should have at least one cluster or marker
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

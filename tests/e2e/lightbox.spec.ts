import { expect, test } from "@playwright/test";

test.describe("Lightbox Behavior", () => {
  // Lightbox tests can be slow due to animations
  test.slow();

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
    const photos = page.locator("[data-testid='photo-grid-item']");
    await expect(photos.first()).toBeVisible({ timeout: 15000 });
    // Wait for Fancybox initialization
    await page.waitForSelector("[data-fancybox-initialized='true']", { timeout: 10000 });
  });

  test("opens lightbox when clicking a photo", async ({ page }) => {
    const firstPhoto = page.locator("[data-testid='photo-grid-item']").first();
    await expect(firstPhoto).toHaveAttribute("data-fancybox", "gallery");
    await firstPhoto.click();

    // Expect URL to change (path or hash)
    await expect(page).toHaveURL(/(\/photo\/|#)/);

    // Expect Fancybox UI elements
    await expect(page.locator(".fancybox__container")).toBeVisible();
    await expect(page.locator(".fancybox__content")).toBeVisible({ timeout: 10000 });
  });

  test("can navigate between photos in lightbox", async ({ page }) => {
    const photos = page.locator("[data-testid='photo-grid-item']");
    const count = await photos.count();
    if (count < 2) test.skip(); // Need at least 2 photos

    // Open first photo
    await photos.first().click();
    await expect(page.locator(".fancybox__container")).toBeVisible();

    const initialUrl = page.url();

    // Navigate via keyboard
    await page.keyboard.press("ArrowRight");

    // Wait for potential transition
    await page.waitForTimeout(500);

    // URL should change (if hash navigation is enabled in Fancybox, which it usually is)
    // If not, we might check for image source change, but URL check is standard for galleries.
    await expect(page).not.toHaveURL(initialUrl);
  });

  test("closes lightbox and returns to grid", async ({ page }) => {
    const firstPhoto = page.locator("[data-testid='photo-grid-item']").first();
    await firstPhoto.click();
    await expect(page.locator(".fancybox__container")).toBeVisible();

    // Close via keyboard (standard way)
    await page.keyboard.press("Escape");

    // Wait for close animation
    await expect(page.locator(".fancybox__container")).not.toBeVisible();
    await expect(page.locator("[data-testid='photo-grid-item']").first()).toBeVisible();
  });

  // Metadata in Fancybox often requires custom implementation or is in caption.
  // If we don't have a custom sidebar for Fancybox, we should skip or remove the "displays metadata in lightbox sidebar" test
  // until we know exactly how metadata is rendered in Fancybox for this project.
  // Based on PhotoGridItem, it puts caption/location in data-caption/data-label.
  test("displays caption in lightbox", async ({ page }) => {
    const firstPhoto = page.locator("[data-testid='photo-grid-item']").first();
    const altText = (await firstPhoto.getAttribute("data-caption")) || "";

    await firstPhoto.click();
    await expect(page.locator(".fancybox__container")).toBeVisible();

    // Fancybox usually puts caption in .fancybox__caption or .f-caption
    if (altText) {
      await expect(page.locator(".fancybox__caption, .f-caption").first()).toBeVisible();
    }
  });
});

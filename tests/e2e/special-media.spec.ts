import { expect, test } from "@playwright/test";

test.describe("Special Media Support", () => {
  test.slow();

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
    const photos = page.locator("[data-testid='photo-grid-item']");
    await expect(photos.first()).toBeVisible({ timeout: 15000 });
    await page.waitForSelector("[data-fancybox-initialized='true']", { timeout: 10000 });
    page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
  });

  test("renders sequence badge on grid items", async ({ page }) => {
    // Find any sequence item
    const sequenceItem = page.locator("[data-media-type='sequence']").first();

    // If no sequences in test data, skip
    if ((await sequenceItem.count()) === 0) {
      test.skip();
      return;
    }

    // Verify badge visibility
    const badge = sequenceItem.locator("[data-testid='sequence-badge']");
    await expect(badge).toBeVisible();

    // Verify badge content (should contain icon and count, e.g., "🔍 3×")
    const badgeText = await badge.textContent();
    expect(badgeText).toMatch(/.*\d+([×x]|\/\d+)/); // Matches "3×" or "1/3"
  });

  test("opens sequence player in lightbox", async ({ page }) => {
    const sequenceItem = page.locator("[data-media-type='sequence']").first();

    if ((await sequenceItem.count()) === 0) {
      test.skip();
      return;
    }

    await sequenceItem.click();

    await page.waitForSelector(".fancybox__container", { state: "attached", timeout: 10000 });

    // Wait for ANY slide/carousel content
    await page.waitForSelector(".sequence-player", { state: "attached", timeout: 15000 });

    // Verify lightbox container
    await expect(page.locator(".fancybox__container")).toBeVisible();

    const player = page.locator(".sequence-player").first();
    await expect(player).toBeVisible({ timeout: 15000 });

    // Check for controls
    const playButton = player.locator("button[aria-label='Play'], button[aria-label='Pause']");
    await expect(playButton).toBeVisible();

    const scrubber = player.locator(".sequence-scrubber");
    await expect(scrubber).toBeVisible();
  });

  test("can scrub through sequence in lightbox", async ({ page }) => {
    const sequenceItem = page.locator("[data-media-type='sequence']").first();

    if ((await sequenceItem.count()) === 0) {
      test.skip();
      return;
    }

    await sequenceItem.click();

    // Wait for player
    const scrubber = page.locator(".sequence-scrubber").first();
    await expect(scrubber).toBeVisible({ timeout: 15000 });

    // Verify initial value (assuming it starts at 0 or moves slightly if autoplay)
    // We pulse space to pause it if it's autoplaying
    await page.keyboard.press(" "); // Toggle pause

    const initialVal = await scrubber.inputValue();

    // Change value
    await scrubber.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    // Wait for update
    await page.waitForTimeout(200);

    // Verify value changed
    const newVal = await scrubber.inputValue();
    expect(parseInt(newVal, 10)).toBeGreaterThan(parseInt(initialVal, 10));
  });
});

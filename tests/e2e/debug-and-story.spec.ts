import { expect, test } from "@playwright/test";

test.describe("Debug Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
    await page.waitForLoadState("networkidle");
  });

  test("toggles debug mode and shows JSON data", async ({ page }) => {
    // Debug button should be visible in dev mode
    const debugButton = page.locator("[data-testid='header-debug-trigger']");
    await expect(debugButton).toBeVisible();

    // Click to enable debug mode
    await debugButton.click();

    // Wait for debug info to appear (bg-slate-950 container with JsonViewer)
    const debugContent = page.locator("div.bg-slate-950").first();
    await expect(debugContent).toBeVisible({ timeout: 5000 });

    // Verify JSON-like content is visible
    const debugText = await debugContent.textContent();
    expect(debugText).toContain("id"); // ImageEntry objects have 'id' property

    // Toggle off
    await debugButton.click();

    // Debug content should be hidden
    await expect(debugContent).not.toBeVisible();
  });

  test("debug mode persists across interaction", async ({ page }) => {
    // Enable debug mode
    const debugButton = page.locator("[data-testid='header-debug-trigger']");
    await debugButton.click();

    // Scroll down to trigger some interaction
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(200);

    // Debug content should still be visible
    const debugContent = page.locator("div.bg-slate-950").first();
    await expect(debugContent).toBeVisible();
  });
});

test.describe("Story Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 60000 });
    await page.waitForLoadState("networkidle");
  });

  test("opens story dialog from separator", async ({ page }) => {
    // Find a "Zobrazit příběh" link in a separator
    const storyLink = page.getByRole("link", { name: /Zobrazit příběh/i });

    // Skip test if no story links found
    const linkCount = await storyLink.count();
    if (linkCount === 0) {
      test.skip(true, "No story links found in current gallery");
    }

    // Click first story link
    await storyLink.first().click();

    // Dialog should open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should contain story content
    const dialogContent = await dialog.textContent();
    expect(dialogContent).toBeTruthy();
    if (!dialogContent) return;
    expect(dialogContent.length).toBeGreaterThan(10);

    // Close dialog
    const closeButton = dialog.getByRole("button", { name: /Zavřít|Close/i });
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Try ESC key
      await page.keyboard.press("Escape");
    }

    // Dialog should close
    await expect(dialog).not.toBeVisible();
  });

  test("story dialog shows title and content", async ({ page }) => {
    const storyLink = page.getByRole("link", { name: /Zobrazit příběh/i });

    const linkCount = await storyLink.count();
    if (linkCount === 0) {
      test.skip(true, "No story links found in current gallery");
    }

    await storyLink.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Should have a heading (story title)
    const heading = dialog.getByRole("heading").first();
    await expect(heading).toBeVisible();

    // Should have content (paragraphs or text)
    const dialogText = await dialog.textContent();
    if (!dialogText) return;
    expect(dialogText.length).toBeGreaterThan(50);
  });
});

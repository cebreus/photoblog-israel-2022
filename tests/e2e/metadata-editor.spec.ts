import { expect, test } from "@playwright/test";
import { exiftool } from "exiftool-vendored";
import fs from "fs";
import path from "path";

test.describe("Metadata Editor E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page with edit mode and sidebar enabled
    await page.goto("/?editMode&sidebar");
  });

  test("should write metadata to source file", async ({ page }) => {
    // 1. Edit mode is already active via URL params

    // 2. Wait for images to load
    await page.waitForLoadState("networkidle");
    const firstImage = page.locator("figure").first();
    await expect(firstImage).toBeVisible({ timeout: 10000 });

    // Get the image ID from the figure element
    const imageId = await firstImage.getAttribute("id");
    expect(imageId).not.toBeNull();

    // Click the overlay to select the image (overlay intercepts clicks)
    await page.locator(`[data-testid="photo-grid-item-overlay-${imageId}"]`).click();

    // Verify selection checkbox is visible using correct data-testid
    await expect(page.locator(`[data-testid="photo-grid-item-checkbox-${imageId}"]`)).toBeVisible();

    // 4. Wait for the Edit tab to be active (sidebar should already be open from URL params)
    const editTab = page.getByTestId("app-sidebar-edit-tab");
    await expect(editTab).toBeVisible({ timeout: 5000 });

    // Click edit tab if not already active
    await editTab.click();

    // Wait for the edit form to be visible
    await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 5000 });

    // 5. Fill in the form with test data
    const testTitle = `E2E Test Title ${Date.now()}`;
    const testCity = "Prague";
    const testCaption = "This is a test caption from E2E";
    const testKeywords = "test, e2e, playwright";

    await page.fill('input[name="title"]', testTitle);
    await page.fill('input[name="city"]', testCity);
    await page.fill('textarea[name="caption"]', testCaption);
    await page.fill('input[name="keywords"]', testKeywords);

    // 6. Submit the form - button text is "Uložit změny"
    // Wait for the API response
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/metadata") && response.status() === 200,
      { timeout: 10000 },
    );

    await page.click('button:has-text("Uložit změny")');

    // 7. Wait for successful API response
    await responsePromise;

    // Give it a moment for the UI to update
    await page.waitForTimeout(500);

    // 8. Get the image ID from the URL
    const url = new URL(page.url());
    const imageIds = url.searchParams.get("edit")?.split(",") || [];
    expect(imageIds.length).toBeGreaterThan(0);

    // 9. Read the manifest to get the source file path
    const contentDir = process.env.CONTENT_DIR || "egypt-2025";
    const manifestPath = path.resolve(process.cwd(), `src/data/${contentDir}/images.manifest.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    // Find the image entry
    let imageEntry = null;
    for (const day of manifest.photoDays) {
      const found = day.items.find((item: any) => item.type === "image" && item.id === imageIds[0]);
      if (found) {
        imageEntry = found;
        break;
      }
    }

    expect(imageEntry).not.toBeNull();

    // 10. Construct the file path
    // imageEntry.src already contains the relative path from content dir (e.g., "pics/IMG_8056.HEIC")
    const contentRoot = path.resolve(process.cwd(), "content", contentDir);
    const filePath = path.join(contentRoot, imageEntry.src);

    // Skip test if source file doesn't exist (test data issue)
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping metadata verification: Source file not found at ${filePath}`);
      test.skip();
      return;
    }

    // 11. Read EXIF data from the file using exiftool
    const metadata = await exiftool.read(filePath);

    // 12. Verify that the metadata was written correctly
    expect(metadata.ObjectName || metadata.Title).toBe(testTitle);
    expect(metadata.City).toBe(testCity);
    expect(metadata["Caption-Abstract"] || metadata.Description).toBe(testCaption);

    // Keywords can be string or array
    const keywords = Array.isArray(metadata.Keywords) ? metadata.Keywords : [metadata.Keywords];
    expect(keywords).toContain("test");
    expect(keywords).toContain("e2e");
    expect(keywords).toContain("playwright");
  });

  test("should handle batch editing of multiple images", async ({ page }) => {
    // 1. Edit mode is already active via URL params

    // 2. Wait for images to load
    await page.waitForLoadState("networkidle");
    const images = page.locator("figure");
    await expect(images.first()).toBeVisible({ timeout: 10000 });

    // Get image IDs
    const id0 = await images.nth(0).getAttribute("id");
    const id1 = await images.nth(1).getAttribute("id");
    const id2 = await images.nth(2).getAttribute("id");

    // Select multiple images by clicking their overlays
    await page.locator(`[data-testid="photo-grid-item-overlay-${id0}"]`).click();
    await page.waitForTimeout(300);
    await page.locator(`[data-testid="photo-grid-item-overlay-${id1}"]`).click();
    await page.waitForTimeout(300);
    await page.locator(`[data-testid="photo-grid-item-overlay-${id2}"]`).click();

    // 3. Verify selection count - look for the selection indicator in EditTab
    // The selection count is shown in the EditTab, not in a "Clear (3)" button
    await page.waitForTimeout(500); // Wait for selection to update

    // Navigate to Edit tab
    const editTab = page.getByTestId("app-sidebar-edit-tab");
    await expect(editTab).toBeVisible({ timeout: 5000 });
    await editTab.click();

    // Wait for edit form to be visible
    await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 5000 });

    // 4. Fill in common metadata (no need to click "Edit" button, form is already open)
    const batchTitle = `Batch Test ${Date.now()}`;
    await page.fill('input[name="title"]', batchTitle);

    // 6. Save - button text is "Uložit změny"
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/metadata") && response.status() === 200,
      { timeout: 10000 },
    );

    await page.click('button:has-text("Uložit změny")');

    // 7. Wait for successful API response
    await responsePromise;
    await page.waitForTimeout(500);

    // 8. Verify all 3 files were updated
    const url = new URL(page.url());
    const imageIds = url.searchParams.get("edit")?.split(",") || [];
    expect(imageIds.length).toBe(3);

    // Read manifest and verify each file
    const contentDir = process.env.CONTENT_DIR || "egypt-2025";
    const manifestPath = path.resolve(process.cwd(), `src/data/${contentDir}/images.manifest.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    for (const id of imageIds) {
      let imageEntry = null;
      for (const day of manifest.photoDays) {
        const found = day.items.find((item: any) => item.type === "image" && item.id === id);
        if (found) {
          imageEntry = found;
          break;
        }
      }

      expect(imageEntry).not.toBeNull();

      const contentRoot = path.resolve(process.cwd(), "content", contentDir);
      const filePath = path.join(contentRoot, imageEntry.src);

      // Skip verification for this file if it doesn't exist
      if (!fs.existsSync(filePath)) {
        console.warn(`Skipping file ${id}: Source not found at ${filePath}`);
        continue;
      }

      const metadata = await exiftool.read(filePath);
      expect(metadata.ObjectName || metadata.Title).toBe(batchTitle);
    }
  });

  test.afterAll(async () => {
    // Clean up: close exiftool process
    await exiftool.end();
  });
});

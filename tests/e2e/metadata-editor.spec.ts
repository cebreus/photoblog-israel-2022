import { test, expect } from "@playwright/test";
import { exiftool } from "exiftool-vendored";
import path from "node:path";
import fs from "node:fs";

test.describe("Metadata Editor E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page in DEV mode
    await page.goto("/");
  });

  test("should write metadata to source file", async ({ page }) => {
    // 1. Activate edit mode by clicking the pencil icon
    await page.click('[aria-label="Toggle Edit Mode"]');
    await expect(page).toHaveURL(/editMode=true/);

    // 2. Select the first image
    const firstImage = page.locator("figure").first();
    await firstImage.click();

    // Verify selection checkbox is visible
    await expect(firstImage.locator("svg")).toBeVisible();

    // 3. Click "Edit Selected" button in header
    await page.click('button:has-text("Edit")');

    // 4. Wait for the metadata editor sheet to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text="Edit Metadata"')).toBeVisible();

    // 5. Fill in the form with test data
    const testTitle = `E2E Test Title ${Date.now()}`;
    const testCity = "Prague";
    const testCaption = "This is a test caption from E2E";
    const testKeywords = "test, e2e, playwright";

    await page.fill('input[id="title"]', testTitle);
    await page.fill('input[id="city"]', testCity);
    await page.fill('textarea[id="caption"]', testCaption);
    await page.fill('input[id="keywords"]', testKeywords);

    // 6. Submit the form
    await page.click('button:has-text("Save")');

    // 7. Wait for success message
    await expect(page.locator("text=/Saved \\d+ image/")).toBeVisible({
      timeout: 10000,
    });

    // 8. Get the image ID from the URL
    const url = new URL(page.url());
    const imageIds = url.searchParams.get("edit")?.split(",") || [];
    expect(imageIds.length).toBeGreaterThan(0);

    // 9. Read the manifest to get the source file path
    const contentDir = process.env.CONTENT_DIR || "egypt-2025";
    const manifestPath = path.resolve(
      process.cwd(),
      `src/lib/data/${contentDir}/images.manifest.json`,
    );
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
    const contentRoot = path.resolve(process.cwd(), "content", contentDir);
    let filePath = path.join(contentRoot, imageEntry.src);

    // Check if file exists in pics subdirectory
    if (!fs.existsSync(filePath)) {
      const candidate = path.join(contentRoot, "pics", imageEntry.src);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
      }
    }

    expect(fs.existsSync(filePath)).toBe(true);

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
    // 1. Activate edit mode
    await page.click('[aria-label="Toggle Edit Mode"]');

    // 2. Select multiple images (first 3)
    const images = page.locator("figure");
    await images.nth(0).click();
    await images.nth(1).click();
    await images.nth(2).click();

    // 3. Verify selection count in header
    await expect(page.locator("text=/Clear \\(3\\)/")).toBeVisible();

    // 4. Open editor
    await page.click('button:has-text("Edit")');

    // 5. Fill in common metadata
    const batchTitle = `Batch Test ${Date.now()}`;
    await page.fill('input[id="title"]', batchTitle);

    // 6. Save
    await page.click('button:has-text("Save")');

    // 7. Wait for success
    await expect(page.locator('text="Saved 3 images."')).toBeVisible({
      timeout: 10000,
    });

    // 8. Verify all 3 files were updated
    const url = new URL(page.url());
    const imageIds = url.searchParams.get("edit")?.split(",") || [];
    expect(imageIds.length).toBe(3);

    // Read manifest and verify each file
    const contentDir = process.env.CONTENT_DIR || "egypt-2025";
    const manifestPath = path.resolve(
      process.cwd(),
      `src/lib/data/${contentDir}/images.manifest.json`,
    );
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
      let filePath = path.join(contentRoot, imageEntry.src);

      if (!fs.existsSync(filePath)) {
        const candidate = path.join(contentRoot, "pics", imageEntry.src);
        if (fs.existsSync(candidate)) {
          filePath = candidate;
        }
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

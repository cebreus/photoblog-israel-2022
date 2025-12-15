import { test, expect } from "@playwright/test";
import { exiftool } from "exiftool-vendored";
import path from "node:path";
import fs from "node:fs/promises";
import { execSync } from "node:child_process";

// --- Test Configuration ---
const CONTENT_DIR_NAME = "egypt-2025";
const IMAGE_FILENAME = "IMG_8056.HEIC";
const TEST_URL = `http://localhost:5173/?editMode=true&contentDir=${CONTENT_DIR_NAME}`;

const TEST_DATA = {
  title: "Fotka z Egypta s diakritikou",
  city: "Příšerně žluťoučké město",
  caption: "Ďábelské ódy a úpějící kůň.",
  keywords: "cestování, Egypt, test, háčky, čárky",
};

const keywordsAsArray = TEST_DATA.keywords.split(",").map((k) => k.trim());

// --- File Paths ---
const contentRoot = path.resolve(process.cwd(), "content", CONTENT_DIR_NAME);
const imagePath = path.join(contentRoot, "pics", IMAGE_FILENAME);
const imageBackupPath = path.join(contentRoot, "pics", `${IMAGE_FILENAME}.bak`);
const manifestPath = path.resolve(
  process.cwd(),
  `src/lib/data/${CONTENT_DIR_NAME}/images.manifest.json`,
);

test.describe(`Metadata Editor E2E for ${CONTENT_DIR_NAME}`, () => {
  // --- Hooks ---
  test.beforeAll(async () => {
    // Create a backup of the original image file before any tests run
    try {
      await fs.access(imagePath);
      await fs.copyFile(imagePath, imageBackupPath);
      console.log(`Backup of ${IMAGE_FILENAME} created at ${imageBackupPath}`);
    } catch (error) {
      throw new Error(
        `Failed to back up source image ${imagePath}. Error: ${error.message}`,
      );
    }
  });

  test.afterAll(async () => {
    // Restore the original image from backup after all tests are done
    try {
      await fs.copyFile(imageBackupPath, imagePath);
      await fs.unlink(imageBackupPath);
      console.log(`Original ${IMAGE_FILENAME} restored.`);
    } catch (error) {
      console.error(`Failed to restore backup: ${error.message}`);
    } finally {
      // Clean up: close the shared exiftool process
      await exiftool.end();
    }
  });

  // --- Test Case ---
  test("should write metadata to HEIC file and verify manifest regeneration", async ({
    page,
  }) => {
    // 1. Navigate to the page and activate edit mode
    await page.goto(`http://localhost:5173/?contentDir=${CONTENT_DIR_NAME}`);
    await page.waitForTimeout(1000); // Wait for JS to become interactive
    await page.locator('[data-testid="toggle-edit-mode-button"]').click();
    await expect(page).toHaveURL(new RegExp(`editMode=true`));

    // 2. Find and select the target image
    const imageId = `img-${IMAGE_FILENAME.replace(/_/g, "")
      .replace(/\..+$/, "")
      .toLowerCase()}`;
    const imageContainer = page.locator(
      `[data-testid="image-container-${imageId}"]`,
    );
    await expect(imageContainer).toBeVisible();
    await imageContainer.click();

    // Verify selection checkbox is now visible
    await expect(
      imageContainer.locator('[data-testid="image-selection-checkbox"]'),
    ).toBeVisible();

    // 3. Click "Edit" button to open the editor
    await page.locator('[data-testid="edit-selected-button"]').click();
    await page.waitForURL("**/*edit=*"); // Wait for the URL to update with the edit param

    const editor = page.locator('[data-testid="metadata-editor"]');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // 4. Fill in the form with test data
    await editor
      .locator('[data-testid="metadata-editor-title-input"]')
      .fill(TEST_DATA.title);
    await editor
      .locator('[data-testid="metadata-editor-city-input"]')
      .fill(TEST_DATA.city);
    await editor
      .locator('[data-testid="metadata-editor-caption-input"]')
      .fill(TEST_DATA.caption);
    await editor
      .locator('[data-testid="metadata-editor-keywords-input"]')
      .fill(TEST_DATA.keywords);

    // 5. Submit the form
    await editor.locator('[data-testid="metadata-editor-save-button"]').click();
    await expect(
      editor.locator('[data-testid="metadata-editor-success-alert"]'),
    ).toBeVisible();

    // --- Verification Step 1: Check physical file on disk ---
    console.log(`Verifying EXIF data in ${imagePath}...`);
    const metadata = await exiftool.read(imagePath);

    expect(metadata.ObjectName || metadata.Title).toBe(TEST_DATA.title);
    expect(metadata.City).toBe(TEST_DATA.city);
    expect(metadata["Caption-Abstract"] || metadata.Description).toBe(
      TEST_DATA.caption,
    );

    const writtenKeywords = Array.isArray(metadata.Keywords)
      ? metadata.Keywords
      : [metadata.Keywords];
    expect(writtenKeywords.sort()).toEqual(keywordsAsArray.sort());

    console.log("EXIF data verification successful.");

    // --- Verification Step 2: Regenerate manifest ---
    console.log("Regenerating manifest...");
    const command = `bun run images:build -- --content-dir ${CONTENT_DIR_NAME} --filter ${IMAGE_FILENAME}`;
    execSync(command, { stdio: "inherit" });
    console.log("Manifest regeneration complete.");

    // --- Verification Step 3: Check data in the manifest ---
    console.log(`Verifying data in manifest: ${manifestPath}`);
    const manifestContent = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestContent);

    let imageEntry = null;
    for (const day of manifest.photoDays) {
      const found = day.items.find(
        (item) => item.type === "image" && item.src.includes(IMAGE_FILENAME),
      );
      if (found) {
        imageEntry = found;
        break;
      }
    }

    expect(imageEntry).not.toBeNull();
    expect(imageEntry.metadata.title).toBe(TEST_DATA.title);
    expect(imageEntry.metadata.city).toBe(TEST_DATA.city);
    expect(imageEntry.metadata.description).toBe(TEST_DATA.caption);
    expect(imageEntry.metadata.keywords.sort()).toEqual(keywordsAsArray.sort());

    console.log("Manifest data verification successful.");
  });
});

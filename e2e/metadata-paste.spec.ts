import { test, expect } from "@playwright/test";

test.describe("Metadata Paste E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to root
    await page.goto("/");
    // Wait for at least one image to verify hydration/loading
    await expect(page.locator("figure").first()).toBeVisible();
  });

  test("should paste metadata with exclusion support (Sidebar flow)", async ({
    page,
  }) => {
    // --- 1. SETUP: Enter Edit Mode directly via URL to ensure stability ---
    // We add 'editMode' (presence) and 'sidebar' (presence) to URL
    await page.goto("/?editMode&sidebar");

    // Identify our test subjects
    const images = page.locator("figure");
    // Ensure we have enough images
    await expect(images.nth(2)).toBeVisible();

    // Use images from the middle to avoid potential separator/group edge cases at the start
    const imageA = images.nth(3);
    const imageB = images.nth(4);
    const imageC = images.nth(5);

    const idA = await imageA.getAttribute("id");
    const idB = await imageB.getAttribute("id");
    const idC = await imageC.getAttribute("id");

    console.log("IDs:", { idA, idB, idC });

    expect(idA, "Image A ID validation").not.toBeNull();
    expect(idB, "Image B ID validation").not.toBeNull();
    expect(idC, "Image C ID validation").not.toBeNull();

    // Ensure uniqueness
    expect(idA).not.toEqual(idB);
    expect(idA).not.toEqual(idC);
    expect(idB).not.toEqual(idC);

    // Ensure Edit Mode is active by waiting for the checkbox container on Image A
    await expect(
      page.locator(`[data-testid="photo-grid-item-checkbox-${idA}"]`),
    ).toBeVisible();

    // --- 2. COPY SOURCE METADATA ---
    // Right click Image A -> Copy Metadata
    await imageA.click({ button: "right" });
    await expect(
      page.locator('[data-testid="photo-grid-item-contextmenu-copy-metadata"]'),
    ).toBeVisible();
    await page.click(
      '[data-testid="photo-grid-item-contextmenu-copy-metadata"]',
    );

    // Optional: Verify clipboard indicator or toast if exists (skipping for now)

    // --- 3. SELECT TARGET IMAGES ---
    // Click overlay of Image B and Image C
    await page.click(`[data-testid="photo-grid-item-overlay-${idB}"]`);
    await page.click(`[data-testid="photo-grid-item-overlay-${idC}"]`);

    // Verify selection (check markers visibility)
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idB}"]`,
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idC}"]`,
      ),
    ).toBeVisible();
    // Image A should NOT be selected
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idA}"]`,
      ),
    ).not.toBeVisible();

    // --- 4. OPEN PASTE DIALOG (SIDEBAR) ---
    // Click "Vložit metadata" button in sidebar/edit-tab
    await page.click('[data-testid="edit-tab-paste-metadata"]');

    // Verify Dialog and Columns
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(
      page.locator(`[data-testid="metadata-paste-dialog-header-${idB}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="metadata-paste-dialog-header-${idC}"]`),
    ).toBeVisible();

    // --- 5. EXCLUDE IMAGE B ---
    // Click exclude toggle for B
    await page.click(`[data-testid="metadata-paste-dialog-exclude-${idB}"]`);

    // Verify visual state (grayscale / text)
    const headerB = page.locator(
      `[data-testid="metadata-paste-dialog-header-${idB}"]`,
    );
    await expect(headerB).toHaveClass(/opacity-50/);
    await expect(headerB.locator("text=VYLUČENO")).toBeVisible();

    // --- 6. CONFIRM AND VERIFY API ---
    // Spy on the network request
    const patchRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes("/api/images") && request.method() === "PATCH",
    );

    await page.click('[data-testid="metadata-paste-dialog-confirm"]');

    const request = await patchRequestPromise;
    const payload = request.postDataJSON();

    // CHECK: ID C should be present, ID B should be absent
    expect(payload.ids).toContain(idC);
    expect(payload.ids).not.toContain(idB);

    // Dialog should handle success and close (toast appears usually)
    await expect(dialog).not.toBeVisible();

    // --- 7. VERIFY FINAL SELECTION STATE ---
    // Logic: Excluded images (B) are deselected. Processed images (C) often remain selected or user choice.
    // Based on implementation: `if (excludedImageIds.has(id)) selection.toggle(id);` -> B is deselected.
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idB}"]`,
      ),
    ).not.toBeVisible();
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idC}"]`,
      ),
    ).toBeVisible();
  });

  test("should paste metadata via Context Menu with multiple selection", async ({
    page,
  }) => {
    // --- 1. SETUP ---
    // --- 1. SETUP ---
    await page.goto("/?editMode&sidebar");

    const images = page.locator("figure");
    const imageA = images.nth(3);
    const imageB = images.nth(4);
    const imageC = images.nth(5);

    const idA = await imageA.getAttribute("id");
    const idB = await imageB.getAttribute("id");
    const idC = await imageC.getAttribute("id");

    // Ensure Edit Mode is active by waiting for the checkbox on Image A
    await expect(
      page.locator(`[data-testid="photo-grid-item-checkbox-${idA}"]`),
    ).toBeVisible();

    // --- 2. COPY A ---
    // Target the ContextMenu Trigger specifically
    const triggerA = page.locator(
      `[data-testid="photo-grid-item-container-${idA}"]`,
    );
    await triggerA.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Give hydration/listeners a moment
    await triggerA.click({ button: "right", force: true });
    await expect(
      page.locator('[data-testid="photo-grid-item-contextmenu-copy-metadata"]'),
    ).toBeVisible();
    await page.click(
      '[data-testid="photo-grid-item-contextmenu-copy-metadata"]',
    );

    // --- 3. SELECT B AND C ---
    await page.click(`[data-testid="photo-grid-item-overlay-${idB}"]`);
    await page.click(`[data-testid="photo-grid-item-overlay-${idC}"]`);

    // Verify selection
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idB}"]`,
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idC}"]`,
      ),
    ).toBeVisible();

    // --- 4. PASTE TO SELECTION VIA CONTEXT MENU ---
    // We need to right-click the element that triggers context menu.
    const triggerC = page.locator(
      `[data-testid="photo-grid-item-container-${idC}"]`,
    );
    await triggerC.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await triggerC.click({ button: "right", force: true });

    // CRITICAL CHECK: Did right-click deselect C?
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idC}"]`,
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        `[data-testid="photo-grid-item-selection-indicator-${idB}"]`,
      ),
    ).toBeVisible();

    const pasteSelectionItem = page.locator(
      '[data-testid="photo-grid-item-contextmenu-paste-metadata-selection"]',
    );
    await expect(pasteSelectionItem).toBeVisible();

    // Verify text says something like "Vložit na 2 vybraných"
    await expect(pasteSelectionItem).toContainText(/2/);

    // Click it
    await pasteSelectionItem.click({ force: true });

    // Verify Dialog Opens
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify specifically that Header for Image B is visible
    await expect(
      page.locator(`[data-testid="metadata-paste-dialog-header-${idB}"]`),
    ).toBeVisible();

    // Verify specifically that Header for Image C is visible
    await expect(
      page.locator(`[data-testid="metadata-paste-dialog-header-${idC}"]`),
    ).toBeVisible();

    // Verify confirm button counts 2 images
    await expect(
      page.locator('[data-testid="paste-dialog-confirm"]'),
    ).toContainText("2");

    // Cancel to clean up
    await page.click('[data-testid="paste-dialog-cancel"]');
    await expect(dialog).not.toBeVisible();
  });
});

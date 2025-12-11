# 🧪 Testing Implementation Plan

> **For AI Agent:** This document contains detailed testing tasks with acceptance criteria, code examples, and validation steps. Follow the phases sequentially and mark completed tasks with ✅.

**Project:** Bun Svelte Photoblog  
**Test Framework:** Vitest (unit), Playwright (E2E)  
**Target Coverage:** 80%+ unit, 100% critical paths  
**Estimated Timeline:** 15-20 working days

---

## 📋 Phase 0: Review Existing Tests (1-2 days)

### Task 0.1: Fix Failing Unit Tests

**File:** `tests/unit/markup.unit.spec.ts`  
**Status:** ✅ COMPLETED  
**Issue:** Test "renders basic markdown" expects `<h1>` but function returns empty string

**Action Required:**

1. Read `src/lib/markup.ts` and understand `renderStoryHtml()` implementation
2. Fix the function or adjust test expectations
3. Ensure all 5 tests pass

**Validation:**

```bash
bun run test:unit tests/unit/markup.unit.spec.ts
# Expected: All tests pass (5/5)
```

**Acceptance Criteria:**

- ✅ All markup tests pass
- ✅ Function behavior matches test expectations
- ✅ No performance regression

---

### Task 0.2: Optimize Slow Tests

**File:** `tests/unit/images-cli.unit.spec.ts`  
**Status:** ⚠️ SLOW (2-3 seconds per test)  
**Issue:** Tests spawn real CLI processes

**Action Required:**

1. Review test implementation
2. Consider mocking file system operations
3. Use smaller test fixtures
4. Add `--bail` flag for faster failure feedback

**Validation:**

```bash
time bun run test:unit tests/unit/images-cli.unit.spec.ts
# Target: < 1 second total
```

**Acceptance Criteria:**

- ✅ Tests complete in < 1s
- ✅ Still validate CLI behavior
- ✅ No flaky tests

---

### Task 0.3: Consolidate E2E Metadata Tests

**Files:**

- `e2e/metadata-editor-egypt.spec.ts`
- `tests/e2e/metadata-editor.spec.ts`

**Status:** ⚠️ DUPLICATE  
**Issue:** Two files with similar names, unclear distinction

**Action Required:**

1. Compare both files to identify overlap
2. Merge or clearly separate concerns (egypt vs israel specific?)
3. Document the distinction if kept separate

**Validation:**

```bash
bun run test:e2e e2e/metadata-editor*.spec.ts
# Verify distinct test scenarios
```

**Acceptance Criteria:**

- ✅ No duplicate test coverage
- ✅ Clear file naming/purpose
- ✅ All tests pass

---

### Task 0.4: Review Demo Test

**File:** `e2e/demo.test.ts`  
**Status:** ⚠️ TOO SIMPLE  
**Issue:** Only checks if h1 exists - not useful

**Action Required:**
Choose one:

- **Option A:** Delete it (basic check not needed)
- **Option B:** Expand to smoke test (check hero, photos, filters visible)

**If expanding, add:**

```typescript
test("homepage loads critical elements", async ({ page }) => {
  await page.goto("/");

  // Hero section
  await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();

  // Photo grid
  await expect(page.locator(".photo-grid")).toBeVisible();

  // Filters trigger
  await expect(
    page.locator('[data-testid="filters-offcanvas-trigger"]'),
  ).toBeVisible();
});
```

**Validation:**

```bash
bun run test:e2e e2e/demo.test.ts
```

**Acceptance Criteria:**

- ✅ Test has clear purpose
- ✅ Validates critical page elements
- ✅ Fast execution (< 3s)

---

## 📊 Phase 0 Summary Checklist

Before proceeding to Phase 1, verify:

- [x] All unit tests pass (0 failures)
- [ ] No tests take > 1s to run (except integration)
- [ ] E2E files have distinct purposes
- [ ] Test coverage report generated
- [ ] No console errors during test runs

**Generate Coverage Report:**

```bash
bun run test:unit --coverage
# Review coverage/index.html
```

---

## 🔴 Phase 1: Critical Store Tests (2-3 days)

### Task 1.1: Test filters.ts Derived Stores

**Priority:** CRITICAL  
**File to Create:** `tests/unit/filters-stores.unit.spec.ts`  
**Dependencies:** `src/lib/stores/filters.ts`, `src/lib/utils/gallery.ts`

**Test Implementation:**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import {
  selectedAuthors,
  showSeparators,
  filteredPhotoDays,
  visiblePhotos,
  totalLocations,
} from "$lib/stores/filters";

describe("filters stores", () => {
  beforeEach(() => {
    // Reset stores to default state
    selectedAuthors.set([]);
    showSeparators.set(true);
  });

  describe("filteredPhotoDays", () => {
    it("filters items by selected authors", () => {
      selectedAuthors.set(["cebreus"]);

      const days = get(filteredPhotoDays);

      // Validate that only cebreus photos remain
      const allItems = days.flatMap((d) => d.items);
      const images = allItems.filter((i) => i.type === "image");

      expect(images.every((img) => img.authorSlug === "cebreus")).toBe(true);
    });

    it("shows/hides separators based on showSeparators", () => {
      showSeparators.set(false);

      const days = get(filteredPhotoDays);
      const allItems = days.flatMap((d) => d.items);
      const separators = allItems.filter((i) => i.type === "separator");

      expect(separators.length).toBe(0);
    });

    it("shows all items when no filter applied", () => {
      selectedAuthors.set([]);
      showSeparators.set(true);

      const days = get(filteredPhotoDays);

      expect(days.length).toBeGreaterThan(0);
    });

    it("returns empty array when no photos match filter", () => {
      selectedAuthors.set(["nonexistent-author"]);

      const days = get(filteredPhotoDays);

      expect(days.length).toBe(0);
    });

    it("reacts to store changes", () => {
      selectedAuthors.set(["cebreus"]);
      const firstResult = get(filteredPhotoDays);

      selectedAuthors.set(["another-author"]);
      const secondResult = get(filteredPhotoDays);

      expect(firstResult).not.toEqual(secondResult);
    });
  });

  describe("visiblePhotos", () => {
    it("counts only image items (not separators)", () => {
      selectedAuthors.set([]);
      showSeparators.set(true);

      const count = get(visiblePhotos);

      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe("number");
    });

    it("decreases count when author filter applied", () => {
      const allCount = get(visiblePhotos);

      selectedAuthors.set(["cebreus"]);
      const filteredCount = get(visiblePhotos);

      expect(filteredCount).toBeLessThanOrEqual(allCount);
    });

    it("does not include separators in count", () => {
      showSeparators.set(true);
      const withSeparators = get(visiblePhotos);

      showSeparators.set(false);
      const withoutSeparators = get(visiblePhotos);

      expect(withSeparators).toBe(withoutSeparators);
    });
  });

  describe("totalLocations", () => {
    it("counts unique locations", () => {
      selectedAuthors.set([]);

      const count = get(totalLocations);

      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe("number");
    });

    it("includes separator locations", () => {
      showSeparators.set(true);
      const withSeparators = get(totalLocations);

      showSeparators.set(false);
      const withoutSeparators = get(totalLocations);

      // Should differ if separators have unique locations
      expect(typeof withSeparators).toBe("number");
      expect(typeof withoutSeparators).toBe("number");
    });
  });
});
```

**Validation:**

```bash
bun run test:unit tests/unit/filters-stores.unit.spec.ts
# Expected: All tests pass
```

**Acceptance Criteria:**

- ✅ Tests pass without importing actual manifest
- ✅ All derived stores tested
- ✅ Reactivity validated
- ✅ Edge cases covered (empty filters, no matches)
- ✅ No performance issues (< 50ms per test)

---

### Task 1.2: Test editorState.ts Stores

**Priority:** CRITICAL  
**File to Create:** `tests/unit/editor-state.unit.spec.ts`  
**Dependencies:** `src/lib/stores/editorState.ts`

**Test Implementation:**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { selection, editMode } from "$lib/stores/editorState";

describe("editorState stores", () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset stores
    selection.clear();
    editMode.set(false);
  });

  describe("selection store", () => {
    it("starts with empty selection", () => {
      const sel = get(selection);
      expect(sel.size).toBe(0);
    });

    it("adds items to selection", () => {
      selection.add("img-1");
      selection.add("img-2");

      const sel = get(selection);
      expect(sel.has("img-1")).toBe(true);
      expect(sel.has("img-2")).toBe(true);
      expect(sel.size).toBe(2);
    });

    it("removes items from selection", () => {
      selection.add("img-1");
      selection.add("img-2");
      selection.remove("img-1");

      const sel = get(selection);
      expect(sel.has("img-1")).toBe(false);
      expect(sel.has("img-2")).toBe(true);
      expect(sel.size).toBe(1);
    });

    it("toggles item selection", () => {
      selection.toggle("img-1");
      expect(get(selection).has("img-1")).toBe(true);

      selection.toggle("img-1");
      expect(get(selection).has("img-1")).toBe(false);
    });

    it("clears all selections", () => {
      selection.add("img-1");
      selection.add("img-2");
      selection.clear();

      expect(get(selection).size).toBe(0);
    });

    it("persists to localStorage", () => {
      selection.add("img-1");
      selection.add("img-2");

      const stored = localStorage.getItem("selection");
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(["img-1", "img-2"]);
    });

    it("restores from localStorage on init", () => {
      localStorage.setItem("selection", JSON.stringify(["img-1", "img-2"]));

      // Re-import to trigger initialization
      // (implementation depends on your store setup)
      const sel = get(selection);

      expect(sel.has("img-1")).toBe(true);
      expect(sel.has("img-2")).toBe(true);
    });
  });

  describe("editMode store", () => {
    it("starts disabled", () => {
      expect(get(editMode)).toBe(false);
    });

    it("enables edit mode", () => {
      editMode.set(true);
      expect(get(editMode)).toBe(true);
    });

    it("toggles edit mode", () => {
      editMode.toggle();
      expect(get(editMode)).toBe(true);

      editMode.toggle();
      expect(get(editMode)).toBe(false);
    });

    it("clears selection when disabled", () => {
      selection.add("img-1");
      editMode.set(true);
      editMode.set(false);

      expect(get(selection).size).toBe(0);
    });
  });
});
```

**Validation:**

```bash
bun run test:unit tests/unit/editor-state.unit.spec.ts
```

**Acceptance Criteria:**

- ✅ All CRUD operations tested
- ✅ localStorage persistence verified
- ✅ Toggle behavior validated
- ✅ Clear on disable tested
- ✅ No localStorage pollution between tests

---

### Task 1.3: Extend urlSync.ts Tests

**Priority:** HIGH  
**File to Extend:** `tests/unit/url-sync.unit.spec.ts`  
**Current Status:** Only `parseBooleanParam` tested

**Add to Existing File:**

```typescript
// Add after existing parseBooleanParam tests

describe("initUrlSync behavior", () => {
  // Note: These tests require browser environment
  // Use vitest-browser or mock browser APIs

  it("initializes stores from URL on first load", () => {
    // Mock URL with params
    const mockUrl = new URL("http://localhost/?separators=false&labels=true");

    // Mock page store
    // ... implement based on your mocking strategy

    initUrlSync([]);

    // Verify stores updated
    expect(get(showSeparators)).toBe(false);
    expect(get(showPhotoLabels)).toBe(true);
  });

  it("syncs URL when stores change", async () => {
    initUrlSync([]);

    showSeparators.set(false);

    // Wait for debounce (300ms)
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Verify URL updated
    expect(window.location.search).toContain("separators=false");
  });

  it("handles browser back button", () => {
    // Test history navigation updates stores
    // Implementation depends on browser test setup
  });
});
```

**Alternative Approach (if browser mocking complex):**

Create E2E test instead:

```typescript
// e2e/url-sync-integration.test.ts
test("URL and stores stay in sync", async ({ page }) => {
  await page.goto("/?separators=true");

  // Open filters
  await page.click('[data-testid="filters-offcanvas-trigger"]');
  await page.waitForSelector('[data-testid="filters-offcanvas"]');

  // Toggle separators
  await page.click('[data-testid="filters-separators-switch"]');
  await page.waitForTimeout(500);

  // Verify URL updated
  expect(page.url()).toContain("separators=false");

  // Go back
  await page.goBack();

  // Verify URL restored and UI reflects it
  expect(page.url()).toContain("separators=true");
});
```

**Validation:**

```bash
bun run test:unit tests/unit/url-sync.unit.spec.ts
# OR
bun run test:e2e e2e/url-sync-integration.test.ts
```

**Acceptance Criteria:**

- ✅ Initialization from URL tested
- ✅ URL update on store change tested
- ✅ Debouncing behavior validated
- ✅ Browser navigation (back/forward) tested

---

## 📊 Phase 1 Summary Checklist

- [ ] All filter stores have tests
- [ ] Editor state stores have tests
- [ ] URL sync is fully tested (unit or E2E)
- [ ] All tests pass
- [ ] Coverage increased by 10%+
- [ ] No flaky tests

---

## 🟡 Phase 2: Utils Function Tests (2 days)

### Task 2.1: Test images.ts Utils

**Priority:** HIGH  
**File to Create:** `tests/unit/images-utils.unit.spec.ts`

**Test Implementation:**

```typescript
import { describe, it, expect } from "vitest";
import {
  getSources,
  getDefaultSource,
  getThumbnailSrc,
} from "$lib/utils/images";

describe("images utils", () => {
  const mockImageEntry = {
    id: "img-001",
    sources: [
      { path: "/img-small.webp", width: 640, type: "image/webp" },
      { path: "/img-large.webp", width: 1920, type: "image/webp" },
      { path: "/img-small.jpg", width: 640, type: "image/jpeg" },
      { path: "/img-large.jpg", width: 1920, type: "image/jpeg" },
    ],
    // ... other required fields
  };

  describe("getSources", () => {
    it("groups sources by type", () => {
      const sources = getSources(mockImageEntry);

      expect(sources).toHaveLength(2); // webp and jpeg
      expect(sources.some((s) => s.type === "image/webp")).toBe(true);
      expect(sources.some((s) => s.type === "image/jpeg")).toBe(true);
    });

    it("generates correct srcset strings", () => {
      const sources = getSources(mockImageEntry);
      const webpSource = sources.find((s) => s.type === "image/webp");

      expect(webpSource?.srcset).toContain("640w");
      expect(webpSource?.srcset).toContain("1920w");
      expect(webpSource?.srcset).toContain(",");
    });

    it("handles single source", () => {
      const singleSource = {
        ...mockImageEntry,
        sources: [{ path: "/img.jpg", width: 1920, type: "image/jpeg" }],
      };

      const sources = getSources(singleSource);

      expect(sources).toHaveLength(1);
      expect(sources[0].srcset).toBe("/img.jpg 1920w");
    });

    it("orders sources by preference (webp first)", () => {
      const sources = getSources(mockImageEntry);

      // WebP should be first if available
      expect(sources[0].type).toContain("webp");
    });
  });

  describe("getDefaultSource", () => {
    it("returns largest JPEG as fallback", () => {
      const fallback = getDefaultSource(mockImageEntry);

      expect(fallback.type).toBe("image/jpeg");
      expect(fallback.width).toBe(1920);
    });

    it("returns first source if no JPEG available", () => {
      const webpOnly = {
        ...mockImageEntry,
        sources: mockImageEntry.sources.filter((s) => s.type === "image/webp"),
      };

      const fallback = getDefaultSource(webpOnly);

      expect(fallback.type).toBe("image/webp");
    });
  });

  describe("getThumbnailSrc", () => {
    it("returns smallest available source", () => {
      const thumb = getThumbnailSrc(mockImageEntry);

      expect(thumb).toContain("small");
      expect(thumb).toBeDefined();
    });

    it("handles missing thumbnail gracefully", () => {
      const noThumb = {
        ...mockImageEntry,
        sources: mockImageEntry.sources.filter((s) => s.width > 1000),
      };

      const thumb = getThumbnailSrc(noThumb);

      expect(thumb).toBeDefined(); // Should fallback to any source
    });
  });
});
```

**Validation:**

```bash
bun run test:unit tests/unit/images-utils.unit.spec.ts
```

**Acceptance Criteria:**

- ✅ All utility functions tested
- ✅ Edge cases covered (empty sources, single source)
- ✅ Fallback logic validated
- ✅ Performance acceptable (< 10ms per test)

---

### Task 2.2: Extend gallery.ts Tests

**Priority:** MEDIUM  
**File to Extend:** `tests/unit/filter-utils.unit.spec.ts`

**Add Test for filterGalleryItems Directly:**

```typescript
describe("filterGalleryItems", () => {
  const mockItems = [
    { type: "image", id: "img-1", authorSlug: "cebreus" },
    { type: "image", id: "img-2", authorSlug: "john" },
    { type: "separator", location: "Prague" },
    { type: "image", id: "img-3", authorSlug: "cebreus" },
  ];

  it("returns all items when no author filter", () => {
    const filtered = filterGalleryItems(mockItems, [], true);

    expect(filtered).toHaveLength(4);
  });

  it("filters by author slug", () => {
    const filtered = filterGalleryItems(mockItems, ["cebreus"], true);

    const images = filtered.filter((i) => i.type === "image");
    expect(images).toHaveLength(2);
    expect(images.every((img) => img.authorSlug === "cebreus")).toBe(true);
  });

  it("hides separators when showSeparators=false", () => {
    const filtered = filterGalleryItems(mockItems, [], false);

    expect(filtered.every((i) => i.type !== "separator")).toBe(true);
  });

  it("combines author filter and separator hiding", () => {
    const filtered = filterGalleryItems(mockItems, ["cebreus"], false);

    expect(
      filtered.every((i) => i.type === "image" && i.authorSlug === "cebreus"),
    ).toBe(true);
  });

  it("handles empty items array", () => {
    const filtered = filterGalleryItems([], ["cebreus"], true);

    expect(filtered).toHaveLength(0);
  });

  it("handles multiple selected authors", () => {
    const filtered = filterGalleryItems(mockItems, ["cebreus", "john"], true);

    const images = filtered.filter((i) => i.type === "image");
    expect(images).toHaveLength(3);
  });
});
```

**Validation:**

```bash
bun run test:unit tests/unit/filter-utils.unit.spec.ts
```

**Acceptance Criteria:**

- ✅ Direct testing (not just through computeTotals)
- ✅ Multiple author selection tested
- ✅ Edge cases covered
- ✅ All tests pass

---

## 🎯 Phase 3: E2E User Flow Tests (3-4 days)

### Task 3.1: Author Filter Workflow E2E

**Priority:** HIGH  
**File to Create:** `e2e/filters-workflow.test.ts`

**Implementation:**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Author filter workflow", () => {
  test("toggle single author filter", async ({ page }) => {
    await page.goto("/");

    // Open filters
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });

    // Find first author switch (assuming "cebreus" exists)
    const authorSwitch = page.locator(
      '[data-testid="filters-author-switch-cebreus"]',
    );
    await expect(authorSwitch).toBeVisible();

    // Toggle author filter ON
    await authorSwitch.click();
    await page.waitForTimeout(500); // Wait for debounce

    // Verify URL updated
    const url = new URL(page.url());
    expect(url.searchParams.get("authors")).toContain("cebreus");

    // Verify photo count changed (check stats)
    const statsPhotos = page.locator('[data-testid="filters-stats-photos"]');
    const photoCount = await statsPhotos.textContent();
    expect(photoCount).toBeTruthy();

    // Toggle author filter OFF
    await authorSwitch.click();
    await page.waitForTimeout(500);

    // Verify URL cleared or param removed
    const urlAfter = new URL(page.url());
    const authorsParam = urlAfter.searchParams.get("authors");
    expect(authorsParam === null || authorsParam === "").toBe(true);
  });

  test("select multiple authors", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });

    // Toggle multiple authors
    await page.click('[data-testid="filters-author-switch-cebreus"]');
    await page.click('[data-testid="filters-author-switch-john"]'); // assuming exists
    await page.waitForTimeout(500);

    // Verify URL contains both
    const url = new URL(page.url());
    const authors = url.searchParams.get("authors");
    expect(authors).toContain("cebreus");
    expect(authors).toContain("john");
  });

  test("back button restores filter state", async ({ page }) => {
    await page.goto("/");
    const initialUrl = page.url();

    // Apply filter
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });
    await page.click('[data-testid="filters-author-switch-cebreus"]');
    await page.waitForTimeout(500);

    const filteredUrl = page.url();
    expect(filteredUrl).not.toBe(initialUrl);

    // Go back
    await page.goBack();
    await page.waitForTimeout(300);

    // Verify URL restored
    expect(page.url()).toBe(initialUrl);

    // Open filters again and verify switch state
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });
    const switchState = await page
      .locator('[data-testid="filters-author-switch-cebreus"]')
      .getAttribute("aria-checked");
    expect(switchState).toBe("false");
  });

  test("filter persists on page reload", async ({ page }) => {
    await page.goto("/?authors=cebreus");

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify filter still active
    expect(page.url()).toContain("authors=cebreus");

    // Open filters and check switch state
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });

    const switchState = await page
      .locator('[data-testid="filters-author-switch-cebreus"]')
      .getAttribute("aria-checked");
    expect(switchState).toBe("true");
  });
});
```

**Validation:**

```bash
bun run test:e2e e2e/filters-workflow.test.ts
```

**Acceptance Criteria:**

- ✅ Single and multiple author selection tested
- ✅ URL sync validated
- ✅ Browser navigation (back/forward) tested
- ✅ Page reload persistence tested
- ✅ UI state matches URL state
- ✅ No flaky tests (passes 3/3 times)

---

### Task 3.2: UI Toggles E2E

**Priority:** MEDIUM  
**File to Create:** `e2e/ui-toggles.test.ts`

**Implementation:**

```typescript
import { test, expect } from "@playwright/test";

test.describe("UI toggles", () => {
  test("toggle photo labels", async ({ page }) => {
    await page.goto("/");

    // Initially labels should be hidden (default)
    // Check if any photo label is visible
    const labelsBefore = await page.locator(".photo-label").count();

    // Open filters and toggle labels
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });

    // Assuming there's a labels switch
    await page.click('[data-testid="filters-location-switch"]'); // adjust testid
    await page.waitForTimeout(500);

    // Close filters to see photo grid
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Verify labels now visible
    const labelsAfter = await page.locator(".photo-label").count();
    expect(labelsAfter).toBeGreaterThan(labelsBefore);

    // Verify URL updated
    expect(page.url()).toContain("labels=true");
  });

  test("toggle separators", async ({ page }) => {
    await page.goto("/");

    // Open filters
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });

    // Count initial separators
    await page.keyboard.press("Escape");
    const separatorsBefore = await page.locator("[data-separator]").count();

    // Toggle separators OFF
    await page.click('[data-testid="filters-offcanvas-trigger"]');
    await page.waitForSelector('[data-testid="filters-offcanvas"]', {
      state: "visible",
    });
    await page.click('[data-testid="filters-separators-switch"]');
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");

    // Verify separators hidden
    const separatorsAfter = await page.locator("[data-separator]").count();
    expect(separatorsAfter).toBe(0);

    // Verify URL
    expect(page.url()).toContain("separators=false");
  });
});
```

**Validation:**

```bash
bun run test:e2e e2e/ui-toggles.test.ts
```

**Acceptance Criteria:**

- ✅ Labels toggle works
- ✅ Separators toggle works
- ✅ URL reflects toggle state
- ✅ Visual changes validated
- ✅ Tests pass consistently

---

## 📦 Phase 4: Component Tests (3-4 days)

### Task 4.1: PhotoGrid Component Test

**Priority:** MEDIUM  
**File to Create:** `tests/unit/PhotoGrid.spec.ts`  
**Framework:** `vitest-browser-svelte`

**Setup vitest-browser if not already:**

```bash
bun add -D @vitest/browser playwright vitest-browser-svelte
```

**Test Implementation:**

```typescript
import { render, screen } from "vitest-browser-svelte";
import { expect, test, describe } from "vitest";
import PhotoGrid from "$lib/components/PhotoGrid.svelte";

describe("PhotoGrid", () => {
  const mockPhotoDays = [
    {
      date: "2022-10-20",
      items: [
        {
          type: "image",
          id: "img-1",
          title: "Test Photo",
          sources: [{ path: "/test.jpg", width: 1920, type: "image/jpeg" }],
        },
      ],
    },
  ];

  test("renders photo grid", async () => {
    render(PhotoGrid, {
      props: { photoDays: mockPhotoDays },
    });

    const image = await screen.findByTestId("image-container-img-1");
    expect(image).toBeTruthy();
  });

  test("handles empty photoDays", async () => {
    render(PhotoGrid, {
      props: { photoDays: [] },
    });

    // Should render without errors
    const grid = screen.queryByRole("img");
    expect(grid).toBeFalsy();
  });

  test("displays photo title", async () => {
    render(PhotoGrid, {
      props: { photoDays: mockPhotoDays },
    });

    const title = await screen.findByText("Test Photo");
    expect(title).toBeTruthy();
  });

  // Add more tests for:
  // - Click handlers
  // - Selection state
  // - Lazy loading behavior
});
```

**Validation:**

```bash
bun run test:unit tests/unit/PhotoGrid.spec.ts
```

**Acceptance Criteria:**

- ✅ Component renders without errors
- ✅ Props handled correctly
- ✅ Empty state tested
- ✅ User interactions tested
- ✅ Tests run in browser environment

---

## 🎓 AI Agent Instructions

### General Guidelines:

1. **Work Sequentially:** Complete Phase 0 before moving to Phase 1
2. **Mark Progress:** Update checkboxes as you complete tasks
3. **Run Tests Frequently:** After each file, run relevant tests
4. **Document Issues:** If a test fails, document why and fix
5. **Refactor When Needed:** If existing code blocks testing, refactor it
6. **Coverage First:** Prioritize critical paths over edge cases initially

### Commands Reference:

```bash
# Run all unit tests
bun run test:unit

# Run specific test file
bun run test:unit path/to/test.spec.ts

# Run tests in watch mode
bun run test:unit --watch

# Run E2E tests
bun run test:e2e

# Run specific E2E test
bun run test:e2e path/to/test.test.ts

# Generate coverage report
bun run test:unit --coverage

# Run all tests (unit + E2E)
bun run test
```

### Debugging Failed Tests:

1. Read error message carefully
2. Check if dependencies are mocked correctly
3. Verify test data matches production data structure
4. Add `console.log` statements if needed
5. Run test in isolation to eliminate side effects
6. Check for timing issues (add waits if needed)

### When to Ask for Help:

- Test architecture is unclear
- Existing code structure prevents testing
- Multiple tests fail after a change
- Coverage doesn't increase as expected
- E2E tests are consistently flaky

### Success Metrics:

- ✅ All tests pass (0 failures)
- ✅ Coverage > 80% for critical modules
- ✅ No flaky tests (pass rate 100%)
- ✅ Fast execution (unit < 1s, E2E < 30s total)
- ✅ Clear test names and descriptions

---

## 📊 Progress Tracking

**Phase 0:** ✅⬜⬜⬜ (1/4 tasks)  
**Phase 1:** ⬜⬜⬜ (0/3 tasks)  
**Phase 2:** ⬜⬜ (0/2 tasks)  
**Phase 3:** ⬜⬜ (0/2 tasks)  
**Phase 4:** ⬜ (0/1 task)

**Overall Progress:** 8% (1/12 tasks completed)

**Next Action:** Start with Phase 0, Task 0.2 - Optimize Slow Tests

---

## 📝 Notes & Decisions Log

Use this section to document important decisions, blockers, and solutions discovered during implementation.

**Example:**

```
2025-12-11: Decided to mock filesystem in images-cli tests instead of using real files
2025-12-11: Found that urlSync requires browser environment - using E2E tests instead
```

---

**Last Updated:** 2025-12-11  
**Document Version:** 1.0  
**Maintained By:** AI Agent

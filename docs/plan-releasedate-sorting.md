# Implementation Plan: Replace sortOrder with ReleaseDate-Based Sorting

## Summary

This plan addresses significant problems with the current drag & drop sorting mechanism when working with:

- **Collages** (composed images replacing multiple sources)
- **Zoom entities** (multi-image sequences `--zoom1from3`, `--zoom2from3`, etc.)
- **Panoramas** and other special media types

The current approach uses a `sortOrder` numeric field stored in:

1. `images.manifest.json` (runtime, per-image)
2. `sortorder.manifest.json` (persistent, per-day array of IDs)

This causes complexity and synchronization issues when images are created/deleted/merged.

## New Architecture

### Concept: Use `xmp:ReleaseDate` for Sort Position

```
┌────────────────────────────────────────────────────────────────┐
│                     DATE FIELD STRATEGY                         │
├────────────────────────────────────────────────────────────────┤
│  DateTimeOriginal / CreateDate    →  PRESERVED (read-only)     │
│  xmp:ReleaseDate                  →  MUTABLE (used for sorting)│
└────────────────────────────────────────────────────────────────┘
```

**Benefits:**

1. **Persisted in file** - Survives any manifest rebuild
2. **Standard XMP field** - Supported by Lightroom, Adobe Bridge, etc.
3. **Semantic meaning** - "Publication date" is logical for gallery ordering
4. **No external manifest** - Eliminates `sortorder.manifest.json`

---

## Phase 1: Analysis & Inventory

### 1.1 Current Sort Implementation (TO BE REMOVED)

#### Files to Modify/Remove

| File                                       | Role                                                        | Action                          |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------- |
| `src/data/*/sortorder.manifest.json`       | Persistent sort order per day                               | **DELETE**                      |
| `shared/types/manifest.ts`                 | `SortOrderManifest` type, `sortOrder` field on `ImageEntry` | **REMOVE**                      |
| `src/lib/utils/reorder.ts`                 | Client-side reorder utilities                               | **REWRITE**                     |
| `src/routes/api/images/reorder/+server.ts` | PATCH/DELETE endpoints                                      | **REWRITE**                     |
| `src/lib/stores/editor.svelte.ts`          | `reorderMode` state                                         | **KEEP** (UI mode still needed) |
| `src/lib/components/PhotoGrid.svelte`      | Drag & drop handlers                                        | **MODIFY**                      |
| `src/lib/components/Header.svelte`         | Reorder mode toggle                                         | **KEEP**                        |
| `scripts/lib/manifests/builder.ts`         | `compareByExifDate()` with sortOrder priority               | **SIMPLIFY**                    |
| `scripts/lib/manifests/incremental.ts`     | Merge sortOrder from persistent manifest                    | **REMOVE**                      |
| `scripts/lib/manifests/repository.ts`      | `loadSortOrderManifest`, `saveSortOrderManifest`            | **REMOVE**                      |
| `src/lib/utils/manifest-validators.ts`     | `isValidSortOrderManifest()`                                | **REMOVE**                      |
| `scripts/lib/gallery/migration.ts`         | `migrateSortOrderManifest()`                                | **REMOVE**                      |
| `src/routes/api/images/collage/+server.ts` | Sort order inheritance logic                                | **SIMPLIFY**                    |

#### Git Commits Related to Current Implementation

| Commit     | Description                                                 |
| ---------- | ----------------------------------------------------------- |
| `63bd8973` | `feat: Implement image reordering with drag & drop support` |
| `2d05980a` | `feat: fix photo reordering and collage sync issues`        |
| `539d5d74` | `feat: ensure collages inherit sort order from sources`     |

---

## Phase 2: Add ReleaseDate Support

### 2.1 Metadata Extraction

**File:** `scripts/lib/image/metadata.ts`

```typescript
// ADD to RawExifData interface
export interface RawExifData extends ManifestExifData {
  // ... existing fields ...
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  ReleaseDate?: Date | string; // NEW
}

// ADD to EXIF_MAPPING
const EXIF_MAPPING: Record<string, (tags: Record<string, unknown>) => unknown> = {
  // ... existing mappings ...
  ReleaseDate: function (tags) {
    return (
      getDateValue(tags, "ReleaseDate") ||
      getDateValue(tags, "XMP:ReleaseDate") ||
      getDateValue(tags, "xmp:ReleaseDate")
    );
  },
};
```

### 2.2 Type Updates

**File:** `shared/types/manifest.ts`

```typescript
// MODIFY ImageEntry
export type ImageEntry = {
  // ... existing fields ...
  date?: string; // Display date (ReleaseDate or DateTimeOriginal)

  exif?: {
    date?: string; // EXIF DateTimeOriginal - DO NOT MODIFY
    releaseDate?: string; // XMP ReleaseDate - USED FOR SORTING (NEW)
    // ... other fields ...
  };

  // REMOVE:
  // sortOrder?: number;        // ❌ DELETE THIS FIELD
};

// REMOVE entire type:
// export type SortOrderManifest = { ... }  // ❌ DELETE
```

### 2.3 Sorting Logic Update

**File:** `scripts/lib/manifests/builder.ts`

```typescript
// REPLACE compareByExifDate function
function compareByExifDate(a: ImageEntry, b: ImageEntry): number {
  // Priority: exif.releaseDate > exif.date (DateTimeOriginal)
  const dateA = a.exif?.releaseDate ?? a.exif?.date ?? "";
  const dateB = b.exif?.releaseDate ?? b.exif?.date ?? "";
  return dateA.localeCompare(dateB);
}
```

---

## Phase 3: New Reorder API

### 3.1 New API Endpoint

**File:** `src/routes/api/images/reorder/+server.ts`

The new API will:

1. Calculate new `ReleaseDate` values based on position
2. Write the dates directly to the image files using exiftool
3. Update the manifest with new values

```typescript
/**
 * PATCH /api/images/reorder
 *
 * Reorders images by modifying their XMP:ReleaseDate values.
 * This persists the order directly in the image files.
 *
 * Payload:
 *   dayId: string - The day to reorder
 *   imageIds: string[] - Ordered list of image IDs in new sequence
 */
export async function PATCH({ request }: RequestEvent) {
  // Validate & load
  const { dayId, imageIds, contentDir } = await request.json();

  // 1. Load manifest to get current dates
  const manifest = await loadImagesManifest(dataPath);
  const targetDay = findDay(manifest, dayId);

  // 2. Calculate new ReleaseDate values
  const baseDateStr = targetDay.date; // e.g., "2025-11-25"
  const newDates = calculateReleaseDates(imageIds, baseDateStr);

  // 3. Write to files using exiftool
  for (const [id, releaseDate] of Object.entries(newDates)) {
    const imagePath = resolveImagePath(id, contentDirRoot);
    await exiftool.write(imagePath, {
      "XMP:ReleaseDate": releaseDate,
    });
  }

  // 4. Update manifest
  for (const item of targetDay.items) {
    if (item.type !== "separator" && newDates[item.id]) {
      item.exif = { ...item.exif, releaseDate: newDates[item.id] };
    }
  }

  await saveImagesManifest(dataPath, manifest);
  await reloadManifests();

  return json({ success: true });
}

/**
 * Calculate ReleaseDate values for an ordered list of images.
 * Creates sequential timestamps within the day.
 *
 * Example output for day "2025-11-25":
 *   image1 -> "2025-11-25T00:00:01Z"
 *   image2 -> "2025-11-25T00:00:02Z"
 *   ...
 */
function calculateReleaseDates(imageIds: string[], baseDate: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (let i = 0; i < imageIds.length; i++) {
    const seconds = i + 1; // 1-based to avoid midnight exactly
    const date = new Date(`${baseDate}T00:00:00Z`);
    date.setSeconds(seconds);
    result[imageIds[i]] = date.toISOString();
  }

  return result;
}
```

### 3.2 Reset Ordering (Revert to EXIF Date)

**IMPORTANT:** ReleaseDate is NEVER deleted - it's reset to DateTimeOriginal value.

```typescript
/**
 * DELETE /api/images/reorder
 *
 * Resets ReleaseDate for all images in a day to their DateTimeOriginal values,
 * effectively reverting to chronological EXIF order.
 *
 * NOTE: We do NOT delete ReleaseDate - we reset it. ReleaseDate must always exist.
 */
export async function DELETE({ request }: RequestEvent) {
  // 1. Load manifest and find day
  const { dayId, contentDir } = await request.json();
  const manifest = await loadImagesManifest(dataPath);
  const targetDay = findDay(manifest, dayId);

  // 2. For each image, reset XMP:ReleaseDate to DateTimeOriginal
  for (const item of targetDay.items) {
    if (item.type === "separator") continue;
    const imagePath = resolveImagePath(item.id, contentDirRoot);

    // Get the original EXIF date
    const originalDate = item.exif?.date ?? new Date().toISOString();

    // Reset ReleaseDate to match DateTimeOriginal
    await exiftool.write(imagePath, {
      "XMP:ReleaseDate": originalDate,
    });

    // Update manifest - releaseDate now equals original date
    if (item.exif) {
      item.exif.releaseDate = originalDate;
    }
  }

  // 3. Save and reload
  await saveImagesManifest(dataPath, manifest);
  await reloadManifests();

  return json({ success: true, message: "Order reset to EXIF dates" });
}
```

### 3.3 Race Condition Mitigation

**Problem:** Simultaneous operations between the reorder API and build scripts (watchdog, `pnpm process`).

**Solution:** Extend existing `withManifestLock()` pattern:

```typescript
export async function PATCH({ request }: RequestEvent) {
  // ... validation ...

  await withManifestLock(dataPath, async () => {
    // 1. Load manifest
    const manifest = await loadImagesManifest(dataPath);

    // 2. Write to files (ExifTool)
    // ... exiftool.write() calls ...

    // 3. Update & save manifest
    await saveImagesManifest(dataPath, manifest);
  });

  // 4. Reload after lock release
  await reloadManifests();
}
```

**Watchdog Cooperation:**

The watchdog (`scripts/watchdog.ts`) detects file changes and triggers re-processing.
To prevent conflicts:

1. **File modification in reorder API** → mtime changes
2. **Watchdog detects change** → triggers rebuild
3. **Rebuild reads new ReleaseDate** → manifest is consistent

Key insight: Since ReleaseDate is written to the file, the watchdog's rebuild will
**automatically pick up** the new dates. No special coordination needed beyond the
existing manifest lock.

---

## Phase 3.5: ReleaseDate Initialization Strategy

### IMPORTANT: ReleaseDate Must Always Be Populated

Unlike the previous `sortOrder` field (which was optional), `ReleaseDate` **must always have a value** for proper sorting to work. We cannot have empty/null values.

### Initialization Rules

1. **New Images (during import/processing)**
   - If no `ReleaseDate` exists in the file → Initialize with `DateTimeOriginal` value
   - This ensures every image has a valid sort date from the start

2. **First Manual Reorder**
   - When user drags to reorder for the first time, ALL images in that day get a `ReleaseDate`
   - This is a one-time "activation" of manual sorting for that day

3. **Collages**
   - Inherit `ReleaseDate` from the earliest source image
   - If sources had no `ReleaseDate`, use their `DateTimeOriginal`

### Build-Time Initialization

**File:** `scripts/lib/image/metadata.ts`

```typescript
export function buildImageEntry(
  baseName: string,
  absPath: string,
  exif: Partial<RawExifData>,
  // ...
): ImageEntry {
  const dateTimeOriginal = getIsoDate(exif);
  const releaseDate = exif.ReleaseDate ? normalizeToIsoDate(exif.ReleaseDate) : dateTimeOriginal; // Fallback to original date

  return {
    // ...
    exif: {
      date: dateTimeOriginal, // Original EXIF date (read-only)
      releaseDate: releaseDate, // Sort date (mutable, never null)
      // ...
    },
  };
}
```

### API Reorder - Bulk Initialization

When first reordering a day, if any images lack `ReleaseDate`:

```typescript
async function ensureReleaseDatesExist(
  dayItems: ImageEntry[],
  contentDirRoot: string,
): Promise<void> {
  const needsInit: ImageEntry[] = [];

  for (const item of dayItems) {
    if (!item.exif?.releaseDate) {
      needsInit.push(item);
    }
  }

  if (needsInit.length === 0) return;

  // Initialize missing ReleaseDates from DateTimeOriginal
  for (const item of needsInit) {
    const imagePath = await resolveImagePath(item.id, contentDirRoot);
    const initialDate = item.exif?.date ?? new Date().toISOString();

    await exiftool.write(imagePath, {
      "XMP:ReleaseDate": initialDate,
    });

    if (item.exif) {
      item.exif.releaseDate = initialDate;
    }
  }

  log.info(`Initialized ReleaseDate for ${needsInit.length} images`);
}
```

---

## Phase 4: Collage Integration

### 4.1 Collage API Updates

**File:** `src/routes/api/images/collage/+server.ts`

When creating a collage:

```typescript
// REMOVE all sortOrderManifest logic (lines ~197-234)

// REPLACE WITH:
// The collage inherits ReleaseDate from the earliest source image
// This happens automatically because we copy all EXIF from metadataSourcePath

// If we need to INSERT the collage at a specific position:
// Calculate a ReleaseDate between neighbors

async function calculateCollageReleaseDate(
  sourceImageIds: string[],
  manifest: Manifest,
  targetDayId: string,
): Promise<string | undefined> {
  const day = manifest.photoDays.find((d) => d.id === targetDayId);
  if (!day) return undefined;

  // Find the earliest source image's position (by current order)
  const images = day.items.filter(isImageEntry);

  // Get the ReleaseDate from the earliest source, or compute one
  const sourceImages = images.filter((img) => sourceImageIds.includes(img.id));
  sourceImages.sort((a, b) =>
    (a.exif?.releaseDate ?? a.exif?.date ?? "").localeCompare(
      b.exif?.releaseDate ?? b.exif?.date ?? "",
    ),
  );

  // Return the earliest source's releaseDate
  return sourceImages[0]?.exif?.releaseDate ?? sourceImages[0]?.exif?.date;
}
```

---

## Phase 5: Cleanup & Removal

### 5.1 Files to Delete

```bash
# Delete persistent sort order manifests
rm src/data/*/sortorder.manifest.json

# These are generated and can be deleted safely
```

### 5.2 Code Removal Checklist

| Location                               | What to Remove                                                       |
| -------------------------------------- | -------------------------------------------------------------------- |
| `shared/types/manifest.ts`             | `sortOrder` field from `ImageEntry`, entire `SortOrderManifest` type |
| `scripts/lib/manifests/repository.ts`  | `loadSortOrderManifest()`, `saveSortOrderManifest()` functions       |
| `scripts/lib/manifests/incremental.ts` | Lines 296-329 (sortOrder merging), `sortOrderMergedCount` variable   |
| `scripts/lib/manifests/builder.ts`     | Lines 145-158 (sortOrder comparison in `compareByExifDate`)          |
| `src/lib/utils/manifest-validators.ts` | `isValidSortOrderManifest()` function, `SortOrderManifest` import    |
| `scripts/lib/gallery/migration.ts`     | `migrateSortOrderManifest()` function                                |
| `scripts/rename-images.ts`             | `migrateSortOrderManifest` import and call                           |
| `scripts/revert-rename.ts`             | `migrateSortOrderManifest` import and call                           |

### 5.3 Import Cleanup

Remove all imports of:

- `SortOrderManifest`
- `loadSortOrderManifest`
- `saveSortOrderManifest`
- `isValidSortOrderManifest`
- `migrateSortOrderManifest`

---

## Phase 6: Client-Side Updates

### 6.1 Reorder Utility Update

**File:** `src/lib/utils/reorder.ts`

```typescript
// Keep the same API surface, but the backend does the heavy lifting
export async function saveImageOrder(
  payload: ReorderPayload,
): Promise<{ success: boolean; error?: string }> {
  // ... same implementation, backend now writes to files
}

export async function clearImageOrder(
  dayId: string,
  contentDir?: string,
): Promise<{ success: boolean; error?: string }> {
  // ... same implementation, backend now clears from files
}

// REMOVE: No longer needed, handled by manifest sorting
// export function reorderArray<T>(...) { ... }
```

### 6.2 PhotoGrid Component

**File:** `src/lib/components/PhotoGrid.svelte`

The drag & drop UI remains largely unchanged - it sends the new order to the API.

---

## Phase 7: Build Process Updates

### 7.1 Metadata Standards

**File:** `shared/utils/metadata-standards.ts`

```typescript
// ADD new standard for ReleaseDate
export const METADATA_STANDARDS: Record<MetadataKey, MetadataFieldConfig> = {
  // ... existing fields ...
  releaseDate: {
    label: "Datum vydání",
    read: ["ReleaseDate", "xmp:ReleaseDate"],
    write: ["XMP:ReleaseDate"],
  },
};
```

### 7.2 Build Script

The build script (`scripts/lib/manifests/incremental.ts`) will:

1. Read `ReleaseDate` from files during metadata extraction
2. Use it for sorting (via updated `compareByExifDate`)
3. No longer merge from external `sortorder.manifest.json`

---

## Phase 8: Migration

### 8.1 One-Time Migration Script

Create: `scripts/migrate-sortorder-to-releasedate.ts`

```typescript
/**
 * Migrates existing sortorder.manifest.json entries to XMP:ReleaseDate in files.
 * Run once before deploying the new system.
 */
async function migrateSortOrderToReleaseDate(gallery: string) {
  const dataPath = `src/data/${gallery}`;
  const sortOrder = await loadSortOrderManifest(dataPath);
  if (!sortOrder) {
    console.log("No sortorder.manifest.json found, nothing to migrate.");
    return;
  }

  const manifest = await loadImagesManifest(dataPath);
  const contentRoot = `content/${gallery}/pics`;

  for (const [dayId, imageIds] of Object.entries(sortOrder)) {
    const baseDate = dayId.replace("day-", "");
    const releaseDates = calculateReleaseDates(imageIds, baseDate);

    for (const [imageId, releaseDate] of Object.entries(releaseDates)) {
      const imagePath = await resolveImagePath(imageId, contentRoot);
      if (imagePath) {
        await exiftool.write(imagePath, {
          "XMP:ReleaseDate": releaseDate,
        });
        console.log(`✓ ${imageId} → ${releaseDate}`);
      }
    }
  }

  console.log(`\nMigration complete. You can now delete ${dataPath}/sortorder.manifest.json`);
}
```

---

## Phase 9: Testing

### 9.1 Test Cases

1. **Basic Reorder**
   - Drag image A after image B
   - Verify ReleaseDate updated in file
   - Verify order persists after page reload
   - Verify order persists after `pnpm process`

2. **Collage Creation**
   - Create collage from images 5, 6, 7
   - Verify collage appears at position 5
   - Verify no orphaned sort order data

3. **Zoom Entity Handling**
   - Reorder a zoom sequence
   - Verify all members maintain relative order

4. **Clear Order**
   - Use "Reset to EXIF order" function
   - Verify ReleaseDate removed from files
   - Verify images sort by DateTimeOriginal

### 9.2 E2E Tests

Add to `tests/e2e/`:

- `reorder-with-releasedate.spec.ts`
- `collage-order-inheritance.spec.ts`

---

## Phase 10: Documentation

### 10.1 Update GEMINI.md

- Remove references to `sortorder.manifest.json`
- Document new ReleaseDate-based sorting

### 10.2 Update ARCHITECTURE.md

- Update "Data Architecture" section
- Remove `SortOrderManifest` from split manifests diagram

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Add ReleaseDate extraction (metadata.ts)                    │
│  2. Add releaseDate to ImageEntry type                          │
│  3. Update compareByExifDate() to use releaseDate               │
│  4. Rewrite /api/images/reorder endpoint                        │
│  5. Update collage API (remove sortOrderManifest logic)         │
│  6. Run migration script on existing galleries                  │
│  7. Delete sortorder.manifest.json files                        │
│  8. Remove sortOrder field and related code                     │
│  9. Update documentation                                        │
│ 10. Add tests                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Risks & Mitigations

| Risk                                     | Mitigation                                              |
| ---------------------------------------- | ------------------------------------------------------- |
| ExifTool write performance               | Batch writes, use `exiftool.batch()` for multiple files |
| File corruption                          | Create backups before migration                         |
| ReleaseDate not supported by all editors | Fallback to DateTimeOriginal in sorting                 |
| Collisions on same timestamp             | Add milliseconds or use sequence counter                |

---

## Success Criteria

- [ ] Drag & drop reordering works with collages
- [ ] Drag & drop reordering works with zoom sequences
- [ ] Order persists through manifest rebuilds
- [ ] No external `sortorder.manifest.json` needed
- [ ] Original `DateTimeOriginal` preserved
- [ ] All existing tests pass
- [ ] New E2E tests pass

---

## Appendix A: Affected Files Summary

### Files to MODIFY

1. `scripts/lib/image/metadata.ts` - Add ReleaseDate extraction
2. `shared/types/manifest.ts` - Add releaseDate field, remove sortOrder
3. `scripts/lib/manifests/builder.ts` - Simplify sorting logic
4. `src/routes/api/images/reorder/+server.ts` - Complete rewrite
5. `src/routes/api/images/collage/+server.ts` - Remove sortOrder logic
6. `src/lib/utils/reorder.ts` - Simplify (backend does heavy lifting)
7. `shared/utils/metadata-standards.ts` - Add releaseDate standard

### Files to REMOVE code from

1. `scripts/lib/manifests/incremental.ts` - Remove sortOrder merging
2. `scripts/lib/manifests/repository.ts` - Remove sortOrder functions
3. `scripts/lib/gallery/migration.ts` - Remove sortOrder migration
4. `src/lib/utils/manifest-validators.ts` - Remove sortOrder validator
5. `scripts/rename-images.ts` - Remove sortOrder migration call
6. `scripts/revert-rename.ts` - Remove sortOrder migration call

### Files to DELETE

1. `src/data/egypt-2025/sortorder.manifest.json`
2. `src/data/israel-2022/sortorder.manifest.json` (if exists)
3. `docs/plan-fix-collage-sort.md` (obsolete)

### New Files to CREATE

1. `scripts/migrate-sortorder-to-releasedate.ts` - Migration script
2. `tests/e2e/reorder-with-releasedate.spec.ts` - E2E tests

---

_Created: 2024-12-31_
_Status: Draft - Awaiting Review_

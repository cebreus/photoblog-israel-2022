# Implementation Plan - Fix Collage Sort Order

This plan addresses a logic flaw where newly created collages would appear at the end of the day if the gallery had been manually reordered, ignoring the collage's correct chronological position.

## Goal Description

Ensure that when a collage is created, it inherits the "Sort Position" of the images it replaces. If I combine photo #10 and #11 into a collage, the collage should effectively become item #10 (or thereabouts), maintaining the user's carefully curated sequence.

## Proposed Changes

### Backend API (`src/routes/api/images/collage/+server.ts`)

We will inject logic to handling `sortorder.manifest.json` **before** the final manifest update.

1.  **Load Sort Order**: Read `sortorder.manifest.json`.
2.  **Determine Position**:
    - Check if the current day has numeric sort orders defined.
    - Find the `sortOrder` index of all source images involved in the collage.
    - Pick the **minimum** (earliest) index found.
3.  **Update Sort Manifest**:
    - Remove all source image IDs from the sort order list.
    - Insert the new `collageId` at the position of that minimum index.
    - Save `sortorder.manifest.json`.
4.  **InMemory Sync**:
    - When constructing the `processResult` (or just before calling `updateManifest`), explicitly assign `image.sortOrder = minSortOrder`.
    - This ensures `organizeDayItems` (called by `updateManifest`) sees the new collage as "sorted" and places it correctly relative to other sorted items.

## Verification Plan

### Automated Tests

Run `pnpm check` and `pnpm format` to ensure no regressions.

### Manual Verification

1.  **Setup**: Drag and drop photos in a day to create a custom order (e.g., reverse order).
2.  **Action**: Select two photos from the _middle_ of this custom order. Create a collage.
3.  **Expectation**: The resulting collage should appear exactly where those photos were (in the middle), **NOT** jump to the end of the list.
4.  **Persistence**: Refresh the page. The order should remain correct.

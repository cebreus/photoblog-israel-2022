# Deep Analysis: Photo Reordering Data Flow

## The Problem

You observed that changing the photo order in the GUI did not result in an immediate visual update, even though the backend logs indicated success.

## Root Cause Analysis

Our investigation revealed a subtle but critical disconnection between the **Metadata** and the **Physical Array Order** within the `images.manifest.json` file.

1.  **Metadata update (Sort Order)**:
    When you reordered photos, the API correctly updated the `sortOrder` property on each image object in memory.

    > The API said: "Applied sortOrder to X images". This was true.

2.  **Array Order (The View)**:
    The SvelteKit frontend renders photos by iterating through the `items` array of each day, exactly as it appears in the JSON manifest.
    _CRITICAL FAILURE_: The API updated the `sortOrder` **properties**, but it **forgot to resort the array** in the JSON payload before saving it to disk.

3.  **The Result**:
    - `images.manifest.json` was saved.
    - Images had `sortOrder: 1, 2, ...` properties correct.
    - **BUT** their positions in the `items` array remained unchanged (original EXIF order).
    - The persistent `sortorder.manifest.json` helped during _full builds_ (because the builder reads it and resorts everything associated with it), but during **runtime patching** (dev mode), this re-sort step was missing.

## The Fix

We have re-engineered the `reorder` API endpoint (`src/routes/api/images/reorder/+server.ts`) to mirror the logic used by the full build process.

1.  **Lightweight Story Loader**: We created a new utility to load story metadata without triggering a full heavy build process.
2.  **Visual Reorganization**: After updating the `sortOrder` properties, the API now explicitly calls `organizeDayItems` from the build toolchain.
    - This function physically sorts the array based on `sortOrder` (and then EXIF date).
    - It also **regenerates separators** (location headers). This allows you to drag photos between location groups within the same day, and the headers will correctly adjust!

## Data Flow Summary (Now)

1.  **GUI**: Sends PATCH request with new order.
2.  **API**:
    - Updates `sortorder.manifest.json` (disk persistence).
    - Updates in-memory `sortOrder` properties.
    - **CALCULATES**: Calls `organizeDayItems` -> Re-sorts array & Fixes Separators.
    - **SAVES**: Writes corrected array to `images.manifest.json`.
    - **RELOADS**: Calls `reloadManifests()` to update server memory.
3.  **Frontend**: Receives fresh data immediately.

This ensures the GUI, the Manifest, and the Build Process are always perfectly synchronized.

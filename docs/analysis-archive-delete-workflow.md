# Deep Analysis: Archive & Delete Workflows

This document details the lifecycle of photo deletion and archiving, including file operations, metadata handling, and critical data consistency mechanisms.

## 1. Deletion Process (`DELETE /api/images`)

When selected photos are deleted:

1.  **Asset Cleanup (Immediate)**:
    - **Generated Assets**: All generated thumbnails, previews, and varying formats (AVIF, WebP) in `static/<gallery>/images/` are immediately deleted.
    - **Cache**: The build cache (`.temp/images.cache.json`) entries are removed to force re-processing if the file ever returns.

2.  **Manifest & Metadata Removal**:
    - **Main Manifest**: The image entry is removed from `images.manifest.json`.
    - **Auxiliary Data**: Data corresponding to the image ID is purged from:
      - `analysis.manifest.json` (AI scores, phash)
      - `embeddings.manifest.json` (Vectors)
      - `faces.manifest.json` (Face detection data)
    - **Constraints**: Removed from `clustering-constraints.json`.

3.  **Physical Deletion**:
    - The source file is effectively "unlinked" (deleted) from the disk.
    - **Collage Sources**: The logic checks `content/<gallery>/collage-sources/` as well. If you delete a photo that is a source for a collage, **that source file is deleted**.
      - _Consequence_: The generated collage image remains, but the collage becomes **uneditable** (cannot re-layout) because its source material is gone.

## 2. Archiving Process (`POST /api/images` action=`archive`)

Archiving is designed to be a "soft remove".

1.  **File Move**: The physical source file is **moved** from `pics/` (or `collage-sources/`) to `archive/`.
    - _Metadata_: All EXIF/IPTC metadata **remains intact** inside the file. It is safely stored in the `archive` folder.

2.  **System Cleanup**:
    - Similar to deletion, the image is **removed from all active manifests** and the build cache/generated assets are cleared.
    - From the perspective of the application, the photo ceases to exist.

## 3. Data Consistency & UI Synchronization

- **Client-Side**: The frontend calls `invalidateAll()` upon success, forcing a reload of data.
- **Server-Side (Fixed)**: Both endpoints now call `reloadManifests()` immediately after disk operations.
  - This forces the running server to **invalidate its in-memory cache**.
  - The next request from the frontend (triggered by `invalidateAll()`) retrieves fresh data.
  - _Result_: Deletions and Archives are reflected instantly in the UI, even in development mode.

## 4. Updates & Thumbnails

- **Thumbnails**: Are **not** generated during these processes (only deleted).
- **Web App Updates**: The web app reflects changes based on the `images.manifest.json`. Since both actions write to this file immediately, the "Source of Truth" is updated.

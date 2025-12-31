# Deep Analysis: Collage Creation & Workflow

This document details the lifecycle of a collage creation, from the API request to the final UI update.

## 1. File Handling & Originals

When a collage is created from a set of images (e.g., `A.jpg`, `B.jpg`):

1.  **Originals Protected**: The original source images (`A.jpg`, `B.jpg`) are **physically moved** from their main location (`content/<gallery>/pics/`) to a subdirectory `content/<gallery>/collage-sources/`.
    - _Purpose_: This removes them from the main gallery scan while preserving them for future editing or reversion.
    - _Safety_: They are not deleted.

2.  **New Asset Creation**:
    - The collage itself is generated and saved as a **new file** in the main folder: `content/<gallery>/pics/A--collage.jpg`.
    - A **configuration sidecar** (`A--collage.json`) is saved alongside it. This contains the layout, crop coordinates, and references to the moved source files, allowing the collage to be "re-hydrated" and edited later.

## 2. Metadata & Sorting

- **EXIF Inheritance**: The API identifies the **oldest** image among the sources (based on `DateTimeOriginal`). It copies the EXIF data from this "donor" image to the new collage file.
  - _Result_: The collage effectively "takes the place" of the original event in the timeline.
- **Manual Sort Order (Smart Inheritance)**:
  - If the user has customized the sort order of the gallery day, the collage **inherits the sort position** of the _sort-earliest source image_.
  - _Example_: If you collage photos sorted as #10 and #12, the new collage becomes #10.
  - _Mechanism_: The API updates `sortorder.manifest.json` immediately, replacing the old source IDs with the new collage ID at the correct index.

## 3. Thumbnail & Variant Generation

Unlike normal photo addition (which relies on the background `watchdog` to pick up changes), the Collage API is **proactive**:

- **Immediate Processing**: The API explicitly imports and calls `processImage` (the same engine used by the build script) **synchronously**.
- **Output**: It immediately generates all necessary optimized versions (AVIF, WebP, varying sizes) and places them in `static/<gallery>/images/`.
- **Impact**: This means when the API responds "Success", the images are already ready to be served by the browser. There is no waiting for a background worker.

## 4. Data Consistency & UI Update

1.  **Manifest Update**:
    - The API calculates the new manifest state.
    - It adds the new collage entry.
    - It **removes** the entries for the source images (since they were moved).
    - It updates `images.manifest.json`, `analysis.manifest.json`, `faces.manifest.json`, and **`sortorder.manifest.json`** on disk.

2.  **Cache Invalidation (The Fix)**:
    - Crucially, the API concludes by calling `reloadManifests()`.
    - This forces the running Node/Bun server to discard its in-memory cache and re-read the updated files from disk.
    - _Result_: The next time the frontend requests data (e.g., immediate page refresh), it receives the new list containing the collage and excluding the separate originals.

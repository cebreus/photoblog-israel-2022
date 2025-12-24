# Deprecated Scripts

## analyze-faces.ts

**Status**: Deprecated on 2025-12-24

**Reason**: Functionality fully covered by `face-clustering.ts`

`analyze-faces.ts` was an experimental script for face detection that wrote results to `images.manifest.json`. This functionality has been superseded by `face-clustering.ts`, which:

- Performs more advanced face detection with clustering
- Writes to dedicated `faces.manifest.json` (cleaner separation)
- Handles manual merges and constraints
- Is actively used in the processing pipeline

**Usage**: None - never added to `package.json` scripts

If you need this functionality, use:

```bash
bun scripts/face-clustering.ts
```

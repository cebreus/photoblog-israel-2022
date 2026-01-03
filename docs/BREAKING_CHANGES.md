# Breaking Changes

> Zásadní změny API a datových struktur, které ovlivňují skripty, pluginy a migrační cesty.

**Navigace:** [← INDEX](./INDEX.md) | [README →](../../README.md)

---

## 2026-01 Release

### 1. Logger Interface (Breaking Change)

**Previous:**

```ts
// Old class-based logger
class Logger {
  info(msg: string) {
    /* ... */
  }
  error(msg: string) {
    /* ... */
  }
}

const logger = new Logger();
logger.info("Hello");
```

**Current:**

```ts
// New Pino-based logger (2024-12+)
import pino from "pino";

const logger = pino({
  level: Bun.env.LOG_LEVEL || "info",
});

logger.info("Hello");
```

**Migration:**

1. Replace class instantiation with `pino()` call
2. Update log level method calls (still `.info()`, `.error()`, etc.)
3. Use structured logging:

```ts
// Before (unstructured)
logger.info("User: John, Action: login");

// After (structured)
logger.info(
  {
    userId: "user-123",
    action: "login",
    timestamp: new Date().toISOString(),
  },
  "User logged in",
);
```

**Impact:**

- All scripts: `scripts/*.ts`
- Build system: `src/hooks.server.ts`
- API routes: `src/routes/api/*/+server.ts`

---

### 2. EXIF Fields Now Required

**Previous:**

```ts
// Fields were optional
interface ImageEntry {
  exif?: {
    date?: string; // ❌ Optional
    releaseDate?: string; // ❌ Optional
    make?: string;
    model?: string;
  };
}
```

**Current:**

```ts
// Fields are now REQUIRED
interface ImageEntry {
  exif: {
    // ✅ Required object
    date: string; // ✅ Required ISO string
    releaseDate: string; // ✅ Required ISO string
    make?: string; // Optional
    model?: string; // Optional
  };
}
```

**Why:**

- ReleaseDate sorting algorithm depends on reliable `releaseDate`
- Sequences grouping requires `date` (EXIF time)
- Wall Clock logic needs both (see ARCHITECTURE.md)

**Migration:**

1. **Audit existing images:**

```bash
bun scripts/audit-people.ts  # Checks for missing EXIF
```

2. **Backfill missing dates:**

```bash
# For images without EXIF date, use file creation time
bun scripts/fix-missing-exif.ts --gallery egypt-2025
```

3. **Validate manifest:**

```bash
bun scripts/manage.ts validate-manifests --gallery egypt-2025
```

**Impact:**

- Manifest: `content/[gallery]/pics.manifest.json`
- API: All `/api/images/*` endpoints
- Queries: `src/routes/+page.ts`

---

### 3. Removal: sortorder.manifest.json

**Previous:**

```ts
// Old sortorder tracking file (deprecated 2025-12)
{
  "IMG_001": 0,
  "IMG_002": 1,
  "IMG_003": 2
}
```

**Current:**

```ts
// Removed. Use XMP:ReleaseDate instead
// In EXIF metadata (ISO string)
{
  "2022-10-20T10:00:00Z": "IMG_001",
  "2022-10-20T10:05:00Z": "IMG_002"
}
```

**Migration:**

```bash
# Migrate old sortorder to XMP:ReleaseDate
bun scripts/migrate-manifests.ts --migrate-sortorder
```

**Side effects:**

- Removes `sortorder.manifest.json` files
- Writes `XMP:ReleaseDate` to all image EXIF
- Updates `pics.manifest.json` with new releaseDate values

---

### 4. Stores: Module-level $state Pattern

**Previous (Svelte 4):**

```ts
// Class-based stores
export class FilterStore {
  private selectedAuthors = writable<Set<string>>(new Set());

  addAuthor(id: string) {
    this.selectedAuthors.update((s) => new Set([...s, id]));
  }
}

export const filters = new FilterStore();
```

**Current (Svelte 5, runes):**

```ts
// Module-level $state
export let selectedAuthors = $state<Set<string>>(new Set());
export let selectedMedia = $state<Set<string>>(new Set());

export function addAuthor(id: string) {
  selectedAuthors.add(id);
}
```

**Why:**

- Faster reactivity (direct mutation vs subscription)
- Smaller bundle size (no subscription overhead)
- Cleaner code (no `.subscribe()`)

**Migration:**

1. Replace writable stores with `$state`:

```ts
// Before
import { writable } from 'svelte/store';
const state = writable(initialValue);

// After
let state = $state(initialValue);
```

2. Update store imports in components:

```svelte
// Before import {filters} from '$lib/stores';
{#each $filters.authors as author}...{/each}

// After import {selectedAuthors} from '$lib/stores/filters.svelte';
{#each selectedAuthors as author}...{/each}
```

3. Use effect runes for side effects:

```svelte
// Before
$: if (selectedAuthor) { fetchPerson(); }

// After
$effect(() => {
  if (selectedAuthor) { fetchPerson(); }
});
```

**Impact:**

- All `.svelte` files using filters, selection stores
- Tests: `tests/unit/stores/*.test.ts`
- Affected stores:
  - `src/lib/stores/filters.svelte.ts`
  - `src/lib/stores/selectedImages.svelte.ts`
  - `src/lib/stores/editingMode.svelte.ts`

---

### 5. Separators: Markdown-driven System

**Previous:**

```ts
// Manual separator creation via API
POST /api/separators {
  "title": "Nazareth",
  "startDate": "2022-10-20T10:00:00",
  "endDate": "2022-10-20T17:00:00"
}
```

**Current:**

```md
## <!-- content/egypt-2025/locations/nazareth.md -->

title: Nazareth
startDate: 2022-10-20T10:00:00
endDate: 2022-10-20T17:00:00
storyImageId: IMG_001

---

Temple of the Annunciation. Ancient city in Galilee.
```

**Auto-generation:**

```ts
// Automatic separator creation if minPhotosForAutoSeparator threshold reached
// src/lib/utils/separators.ts
const minPhotosForAutoSeparator = 3; // config in scripts/build.config.ts

// Photos with same EXIF location are automatically grouped
```

**Migration:**

1. Convert API-created separators to markdown:

```bash
bun scripts/migrate-manifests.ts --convert-separators-to-markdown
```

2. Add markdown metadata:

```yaml
---
title: "Location Name"
startDate: "YYYY-MM-DDTHH:mm:ss"
endDate: "YYYY-MM-DDTHH:mm:ss"
storyImageId: "IMG_XXX"
---
Description (markdown supported)
```

**Impact:**

- Directory: `content/[gallery]/locations/`
- API: POST/PATCH `/api/separators` still available for dev mode
- Build: `scripts/build.config.ts` thresholds

---

### 6. Sequences: 10-minute Detection Window

**Previous:**

```ts
// Manual sequence grouping
POST /api/sequences {
  "imageIds": ["IMG_001", "IMG_002"],
  "representativeId": "IMG_001"
}
```

**Current:**

```ts
// Automatic detection based on EXIF time + location
// Window: 10 minutes between first and last photo
// Condition: All photos must have SAME EXIF location field

interface SequenceInfo {
  id: string; // Identifier: "d1_seq_0"
  representativeId: string;
  members: string[]; // 2+ members
  minTime: string; // EXIF time of earliest
  maxTime: string; // EXIF time of latest
}
```

**Key behavior:**

```
EXIF Times:
IMG_001: 2022-10-20 10:00:00
IMG_002: 2022-10-20 10:05:00
IMG_003: 2022-10-20 10:09:00
IMG_004: 2022-10-20 10:11:00 ❌ (exceeds 10-min window)

Result: Sequence with IMG_001, IMG_002, IMG_003
        IMG_004 is separate
```

**All members inherit representative's PhotoDay:**

```
Representative (IMG_001): 2022-10-20 (PhotoDay)
Member 1 (IMG_002): EXIF 2022-10-20 → Assigned to 2022-10-20 PhotoDay
Member 2 (IMG_003): EXIF 2022-10-20 → Assigned to 2022-10-20 PhotoDay
```

**Migration:**

Automatic. No action needed. Sequences are recalculated on build:

```bash
bun run build  # Recalculates all sequences
```

**Impact:**

- Gallery: PhotoGrid displays sequence players
- API: GET `/api/images` includes `sequenceInfo`
- Sorting: Sequences respect representative's time slot

---

### 7. Collages: Category System

**Previous:**

```ts
// Manual tracking of collage components
interface ImageEntry {
  collage?: {
    sourceIds: string[];
  };
}
```

**Current:**

```ts
// Category-based system
interface ImageEntry {
  category?: "collage" | "collage-source";
  collageInfo?: {
    sources: string[]; // Source image IDs
  };
}
```

**Behavior:**

```ts
// When creating collage:
1. New image created with category: "collage"
2. Source images marked category: "collage-source" (hidden from main view)
3. Collage inherits people tags + releaseDate from representative source
```

**Migration:**

Automatic during build:

```bash
bun run build  # Reclassifies collages
```

---

### 8. CLAP: HEIC Native Crop Metadata

**Previous:**

```ts
// No CLAP support
// Manual image cropping in post-processing
```

**Current:**

```ts
// HEIC/HEIF native crop metadata
interface CleanApertureData {
  width: number; // Crop dimensions (px)
  height: number;
  horizOffset: number; // Offset from top-left (px)
  vertOffset: number;
}

interface ImageEntry {
  clap?: CleanApertureData;
}
```

**Coordinate systems:**

```
Native EXIF (HEIC container):
- Coordinates relative to original sensor resolution
- May be rotated (depends on EXIF Orientation)

User-space (our system):
- Coordinates relative to displayed image (after EXIF rotation applied)
- Used in ClapEditor UI
```

**Migration:**

No action needed. CLAP is extracted during build:

```bash
bun run build  # Extracts CLAP from HEIC files
```

---

## 2025-12 Release

### Fixes

1. **Blur detection:** Improved accuracy with new TensorFlow model
2. **Face clustering:** Fixed false positive grouping
3. **Underwater detection:** Better color correction for deep water photos

---

## Migration Checklist

Before upgrading:

```bash
# 1. Backup manifests
cp -r content/*/pics.manifest.json /backup/manifests.backup.json

# 2. Run audit
bun scripts/audit-people.ts

# 3. Migrate old data
bun scripts/migrate-manifests.ts

# 4. Update environment
cp .env.example .env
# Set LOG_LEVEL, GEOCODE_API_KEY, etc.

# 5. Rebuild everything
bun run clean
bun run build

# 6. Validate
bun run test
bun run check
```

---

## Deprecations

### Currently Deprecated (removal scheduled)

| Feature                   | Status     | Removal | Alternative                |
| ------------------------- | ---------- | ------- | -------------------------- |
| `sortorder.manifest.json` | Deprecated | 2026-06 | XMP:ReleaseDate in EXIF    |
| Class-based Logger        | Deprecated | 2026-03 | Pino logger                |
| Writable stores           | Deprecated | 2026-06 | Svelte 5 $state runes      |
| Manual separator API      | Deprecated | 2026-12 | Markdown-driven (auto-gen) |

---

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System overview
- [ARCH-FEATURES.md](./ARCH-FEATURES.md) — Feature descriptions
- [README.md](../../README.md) — Version history

---

_Poslední aktualizace: 2026-01-05_

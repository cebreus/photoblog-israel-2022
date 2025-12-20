# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern SvelteKit photoblog powered by Bun runtime supporting **multiple galleries from a single codebase**. Each gallery has its own content, configuration, and generated files. The system generates optimized images in multiple formats (AVIF, WebP, JPEG) and sizes, with LQIP placeholders and EXIF metadata extraction.

## Core Technologies

- **Framework**: SvelteKit (Svelte 5 with runes)
- **Runtime**: Bun (both runtime and package manager)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Image Processing**: Sharp (requires libvips system library)
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Linting**: Biome, Stylelint
- **Formatting**: Biome, Prettier

## Gallery Context (`CONTENT_DIR`)

The entire system is controlled by the **`CONTENT_DIR` environment variable**. This determines which gallery (subdirectory in `content/`) is active for development, build, or generation.

- `CONTENT_DIR=israel-2022`: Works with `content/israel-2022/` and generates to `static/israel-2022/`
- `CONTENT_DIR=egypt-2025`: Works with `content/egypt-2025/` and generates to `static/egypt-2025/`

## Common Commands

### Development

```bash
bun install              # Install dependencies
bun run dev              # Start dev server (defaults to egypt-2025)
bun run dev:israel       # Start dev server for israel-2022 gallery
bun run dev:egypt        # Start dev server for egypt-2025 gallery
bun run preview          # Preview production build locally
```

**Note:** Dev commands use `--manifestOnly` flag to quickly regenerate the manifest without reprocessing all images, significantly speeding up server startup.

### Building

```bash
bun run build            # Build egypt-2025 to build-egypt-2025/
bun run build:israel     # Build israel-2022 to build-israel-2022/
bun run build:egypt      # Build egypt-2025 to build-egypt-2025/
```

Each build runs: image generation → favicon generation → Vite build

### Image Generation & Asset Management

```bash
bun run images:build     # Generate all image variants and manifest
bun run images:watch     # Watch mode for automatic regeneration
bun run images:blur      # Generate blur placeholders only
bun run images:all       # Run both build and blur sequentially

# Gallery-specific manifest regeneration
bun run manifest:build:israel       # Rebuild manifest for israel-2022
bun run manifest:build:egypt        # Rebuild manifest for egypt-2025
bun run manifest:curation:israel    # Build curation manifest for israel-2022
bun run manifest:curation:egypt     # Build curation manifest for egypt-2025

# Gallery-specific analysis
bun run analyze:israel   # Run similarity analysis for israel-2022
bun run analyze:egypt    # Run similarity analysis for egypt-2025

# Favicon generation
bun run favicons:build   # Generate favicons (uses CONTENT_DIR)
```

The image generation script (`scripts/generate-images.ts`) supports extensive CLI options:

- `--manifestOnly`: Regenerate manifest without reprocessing images (fast)
- `--curation`: Generate curation manifest with duplicate detection
- `--watch`: Enable watch mode for development
- `--clean`: Remove orphaned files after build
- `--limit=<n>`: Limit number of processed images (useful for testing)
- `--concurrency=<n|auto>`: Control parallel processing
- `--verbose`: Detailed logging
- `--quiet`: Suppress output

**Example with context:**

```bash
CONTENT_DIR=egypt-2025 bun run images:build
```

### Testing

```bash
bun run test             # Run all tests (unit + E2E)
bun run test:unit        # Unit tests only
bun run test:e2e         # E2E tests with Playwright

# Component tests (require CONTENT_DIR)
CONTENT_DIR=egypt-2025 bun run vitest run --project client

# Image-related tests
bun run test:unit:images # Unit tests for image processing
bun run test:images      # Integration and E2E image tests
```

See `TESTING.md` for detailed testing strategy and best practices.

### Code Quality

```bash
bun run lint             # Check code with Biome and Stylelint
bun run lint:fix         # Auto-fix issues with Biome
bun run format           # Format code with Biome and Prettier
bun run format:check     # Check formatting without writing
bun run check            # Type-check with svelte-check
```

## Architecture

### Multi-Gallery Structure

The project is divided into three main layers:

1. **Content Layer** (`content/<gallery-name>/`):
   - `pics/`: Source high-resolution photos
   - `site.md`: Gallery configuration (names, SEO, favicon settings, PWA manifest)
   - `favicons-source.png`: Source image for favicon generation
   - Story markdown files for location narratives

2. **Static Assets Layer** (`static/<gallery-name>/`):
   - `images/`: Optimized image variants (AVIF, WebP, JPEG)
   - `assets/favicons/`: Generated favicons and manifests
   - Directory structure mirrors content structure

3. **Application Layer** (`src/`):
   - Shared SvelteKit application for all galleries
   - Loads data from `src/data/<gallery-name>/` manifests
   - Dynamically builds pages based on manifest data

### Path Resolution

The project uses a special `$manifests` alias that resolves to the active gallery's data:

```typescript
// In svelte.config.js and vite.config.ts
alias: {
  $manifests: path.resolve(__dirname, "src/lib/data", contentDir);
}
```

This allows imports like `import manifest from '$manifests/images.manifest.json'` to automatically load the correct gallery.

### Image Generation Pipeline

The core system (`scripts/generate-images.ts`) processes images through:

1. **Source Scanning**: Finds JPEG/PNG/HEIC images in `content/<gallery>/pics/`
2. **EXIF Extraction**: Extracts date, location, GPS, IPTC, and XMP metadata using exifr
3. **Variant Generation** (defined in `scripts/config.ts`):
   - `default`: 370×208px (mobile and large desktop)
   - `xl`: 534×300px (tablets and medium desktop)
   - `detail`: 1280px width (lightbox/full view)
   - `fallback`: 190×107px (tiny fallback)
   - `placeholder`: 24px blur asset (LQIP)
4. **Format Encoding**: AVIF, WebP, JPEG for each variant
5. **Manifest Generation** (`src/data/<gallery>/`):
   - `images.manifest.json`: Core structural data (Photo days, basic EXIF, responsive sources)
   - `analysis.manifest.json`: Sidecar for `aestheticScore`, `sharpness`, `qualityBucket`, and `phash`
   - `embeddings.manifest.json`: Sidecar for vector embeddings
   - `faces.manifest.json`: Sidecar for face detections and person assignments
6. **Menu Manifest** (`src/data/<gallery>/menu.manifest.json`): Lightweight navigation structure
7. **Site Manifest** (`src/data/<gallery>/site.manifest.json`): Parsed site configuration

**Key features:**

- Intelligent caching (`.temp/<gallery>/images.cache.json`) with hash-based change detection
- Parallel processing with configurable concurrency
- Watch mode for development
- Orphan file cleanup
- Dominant color extraction for placeholders
- Author slug normalization for URL sharing

### Data Flow

```
content/<gallery>/pics/ (JPEG + .md stories)
    ↓
scripts/generate-images.ts (Sharp processing + EXIF extraction)
    ↓
src/data/<gallery>/*.manifest.json (Split & Link manifests)
    ↓
SvelteKit +layout.server.ts (Aggregated at runtime/build)
    ↓
Svelte stores (filters, curation, editor state)
    ↓
UI Components (PhotoGrid, Sidebar, etc.)
```

### Type System

All types are centralized in `src/lib/types/manifest.ts`:

- `Manifest`: Root structure containing `photoDays[]`
- `PhotoDay`: Single day with `date`, `id`, and `items[]`
- `PhotoDayItem`: Union of `ImageEntry | Separator`
- `ImageEntry`: Complete image data (metadata, EXIF, sources, author, keywords)
- `ImageSource`: Single image variant (format, dimensions, path)
- `Separator`: Location markers in the photo grid
- `SiteManifest`: Gallery configuration from `site.md`
- `MenuManifest`: Lightweight navigation menu
- `CurationManifest`: Duplicate detection and recommendations
- `Author`: Author data with name, count, and canonical slug

These types are shared between:

- Build-time scripts (`scripts/generate-images.ts`, `scripts/lib/manifest-builder.ts`)
- Runtime utilities (`src/lib/index.ts`)
- SvelteKit routes (`+layout.server.ts`, `+page.server.ts`)
- Svelte stores (`src/lib/stores/*.ts`)
- UI components

### SvelteKit Structure

- **Routes**: Standard file-based routing
  - `+layout.server.ts`: Loads all manifests, gathers authors, exposes to all pages
  - `+layout.ts`: Client-side layout data
  - `+page.server.ts`: Page-specific data loading
  - `api/`: Server endpoints for geocoding, metadata, and image operations

- **Key Components**:
  - `PhotoGrid.svelte`: Main photo display with masonry grid
  - `AppSidebar.svelte`: Sidebar with filters, agenda, and editor tabs
  - `FiltersTab.svelte`: Author filtering and separator toggle
  - `EditTab.svelte`: Metadata editor for curating images
  - `AgendaTab.svelte`: Navigation menu for photo days
  - `Hero.svelte`: Hero section with page title
  - `src/lib/components/ui/`: Reusable UI components (Shadcn-inspired)

- **Stores** (`src/lib/stores/`):
  - `filters.ts`: Filter state (authors, separators) and derived filtered data
  - `curation.ts`: Curation workflow state and decisions
  - `editorState.ts`: Multi-selection and editing state
  - `urlSync.ts`: URL synchronization for shareable filter links
  - `metadataClipboard.ts`: Copy/paste metadata between images
  - `photoLabels.ts`: Dynamic photo labels and stats
  - `uiState.ts`: UI visibility state (sidebar, debug panels)
  - `scrollspy.ts`: Active section detection for navigation

- **Utilities** (`src/lib/utils/`):
  - `images.ts`: Image utility functions, srcset generation
  - `gallery.ts`: Gallery filtering and statistics
  - `strings.ts`: String utilities including slug generation
  - `menu.ts`: Menu building and navigation
  - `pages.ts`: Page metadata and SEO

### Build Configuration

- **Adapter**: `@sveltejs/adapter-static` (static site generation)
  - Output directory controlled by `OUTPUT_DIR` env variable
  - `fallback: '404.html'` for SPA-style fallback
- **Preprocessor**: `vitePreprocess()` for Svelte compilation
- **Tailwind**: v4 with `@tailwindcss/vite` plugin
- **Vitest**: Configured for both client (browser) and server tests
  - Client tests use `@vitest/browser` with Playwright
  - Server tests use Node.js environment

## Important Notes

### System Requirements

**Sharp requires libvips to be installed:**

- macOS: `brew install vips`
- Debian/Ubuntu: `sudo apt-get install -y libvips`

Without libvips, Sharp won't work and image generation will fail.

### Content Location

Source images are in `content/<gallery>/pics/` (within the project). Each gallery maintains its own content directory with configuration (`site.md`), source images, and story markdown files.

### Cache Management

The `.temp/<gallery>/images.cache.json` file tracks processed images by hash and mtime. If you modify `scripts/config.ts` or change quality settings, increment `CACHE_VERSION` in `generate-images.ts` to force regeneration of all images.

### Manifest-Only Regeneration

Use `--manifestOnly` flag to rebuild the manifest without reprocessing images. Useful when only story content or metadata changes. This is what dev commands use to start quickly.

### Watch Mode Limitations

Watch mode (`--watch`) monitors source directory and regenerates on file changes. It's designed for development but requires manual restart if config changes.

### Author Slugs & URL Sharing

The app treats author filter values as canonical slugs for URL sharing. The build step produces `authorSlug` on each image entry, and the URL parameter uses slugs (e.g., `authors=john-doe,jane-smith`) for stability.

### Adding a New Gallery

1. Create new directory in `content/`, e.g. `content/nova-galerie`
2. Add source photos to `content/nova-galerie/pics/`
3. Create `site.md` configuration file (copy and modify existing)
4. Add new scripts to `package.json`:
   ```json
   "dev:nova-galerie": "CONTENT_DIR=nova-galerie bun run images:build --manifestOnly && CONTENT_DIR=nova-galerie bun run favicons:build && CONTENT_DIR=nova-galerie bun run vite dev",
   "build:nova-galerie": "CONTENT_DIR=nova-galerie OUTPUT_DIR=build-nova-galerie bun run build"
   ```
5. Run: `bun run dev:nova-galerie`

## Development Workflow

1. **Initial setup**: `bun install` + install libvips
2. **Select gallery**: Set `CONTENT_DIR` or use gallery-specific scripts
3. **Add photos**: Place JPEGs in `content/<gallery>/pics/`
4. **Generate images**: `bun run images:build` (or use `--manifestOnly` for fast manifest rebuild)
5. **Start dev server**: `bun run dev:<gallery>`
6. **Make changes**: Edit Svelte components or add stories (markdown files)
7. **Test**: `bun run test` before committing
8. **Build production**: `bun run build:<gallery>`

## Testing Strategy

- **Unit tests** (`tests/unit/`): Test image script utilities and business logic in isolation
- **Component tests** (`.svelte.test.ts`): Test Svelte components in real browser with Vitest Browser Mode
- **Integration tests** (`tests/integration/`): Test full image generation pipeline
- **E2E tests** (`e2e/`): Playwright tests for complete user workflows

**Key Testing Patterns:**

- Component tests require mocking Svelte stores (see `TESTING.md`)
- Component tests need `CONTENT_DIR` set for proper manifest resolution
- Use `data-testid` attributes for test selectors
- Image tests may need `SHARP_NUM_THREADS=1` to avoid race conditions

Run specific test suites:

- `bun run test:unit`: All unit tests
- `CONTENT_DIR=egypt-2025 bun run vitest run --project client`: Component tests
- `bun run test:unit:images`: Image processing unit tests
- `bun run test:images`: Integration and E2E image tests
- `bun run test:e2e`: Playwright E2E tests

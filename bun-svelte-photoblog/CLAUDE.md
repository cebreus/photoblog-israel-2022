# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern SvelteKit photoblog powered by Bun runtime and featuring an advanced image generation system. The project generates optimized images in multiple formats (AVIF, WebP, JPEG) and sizes, with LQIP placeholders and EXIF metadata extraction.

## Core Technologies

- **Framework**: SvelteKit (Svelte 5 with runes)
- **Runtime**: Bun (both runtime and package manager)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Image Processing**: Sharp (requires libvips system library)
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Linting**: Biome, Stylelint
- **Formatting**: Biome, Prettier

## Common Commands

### Development

```bash
bun install              # Install dependencies
bun run dev              # Start dev server with hot-reload
bun run preview          # Preview production build locally
```

### Building

```bash
bun run build            # Full production build (runs prebuild -> images:build -> vite build)
bun run prebuild         # Runs linting and image generation
```

### Image Generation

```bash
bun run images:build     # Generate all image variants and manifest
bun run images:watch     # Watch mode for automatic regeneration
bun run images:blur      # Generate blur placeholders only
bun run images:all       # Run both build and blur sequentially
```

The image generation script (`scripts/generate-images.ts`) supports extensive CLI options:

- `--src=<path>`: Source image directory
- `--out=<path>`: Output directory for generated images
- `--manifest=<path>`: Path to output manifest JSON
- `--watch=true`: Enable watch mode
- `--clean=true`: Remove orphaned files after build
- `--limit=<n>`: Limit number of processed images (useful for testing)
- `--concurrency=<n|auto>`: Control parallel processing
- `--manifest-only=true`: Regenerate manifest without reprocessing images
- `--verbose=true`: Detailed logging

### Testing

```bash
bun run test             # Run all tests (unit + E2E)
bun run test:unit        # Unit tests only
bun run test:e2e         # E2E tests with Playwright
bun run test:all         # All image-related tests (unit + integration + E2E)
```

### Code Quality

```bash
bun run lint             # Check code with Biome and Stylelint
bun run lint:fix         # Auto-fix issues with Biome
bun run format           # Format code with Biome and Prettier
bun run format:check     # Check formatting without writing
bun run check            # Type-check with svelte-check
```

## Architecture

### Image Generation Pipeline

The core of this project is the image generation system (`scripts/generate-images.ts`), which:

1. **Scans source directory** for JPEG images
2. **Extracts EXIF data** (date, location, GPS coordinates) using exifr
3. **Generates multiple variants** defined in `scripts/config.ts`:
   - `default`: 370x208px (for mobile and large desktop)
   - `xl`: 534x300px (for tablets and medium desktop)
   - `detail`: 1280px width (for lightbox/full view)
   - `fallback`: 190x107px (tiny fallback)
   - `placeholder`: 24px blur asset (LQIP)
4. **Creates multiple formats** for each variant: AVIF, WebP, JPEG
5. **Generates manifest** (`src/lib/images.manifest.json`) with:
   - Photo day grouping by date
   - Image metadata (dimensions, aspect ratios, EXIF)
   - Source paths for responsive `<picture>` elements
   - Separators for location changes
   - Story content from markdown files

**Key features:**

- Intelligent caching (`.images-cache.json`) to skip unchanged files
- Parallel processing with configurable concurrency
- Watch mode for development
- Orphan file cleanup
- Dominant color extraction for placeholders

### Data Flow

```
Content (JPEG + .md stories)
    ↓
generate-images.ts (Sharp processing)
    ↓
images.manifest.json (structured data)
    ↓
src/lib/images.ts (runtime utilities)
    ↓
SvelteKit routes & components
```

### Type System

All types are centralized in `src/lib/types/manifest.ts`:

- `Manifest`: Root structure containing `photoDays[]`
- `PhotoDay`: Single day with `date`, `id`, and `items[]`
- `PhotoDayItem`: Union of `ImageEntry | Separator`
- `ImageEntry`: Complete image data (metadata, EXIF, sources)
- `ImageSource`: Single image variant (format, dimensions, path)
- `Separator`: Location markers in the photo grid

These types are shared between:

- Build-time scripts (`scripts/generate-images.ts`)
- Runtime code (`src/lib/images.ts`)
- SvelteKit routes and components

### SvelteKit Structure

- **Routes**: Standard file-based routing
  - `+page.server.ts`: Server-side data loading (fetches photoDays from manifest)
  - `+layout.ts`: Client-side layout data
  - `+layout.server.ts`: Server-side layout data

- **Components**:
  - `PhotoGrid.svelte`: Main photo display grid
  - `Hero.svelte`: Hero section with navigation
  - `Header.svelte`, `Footer.svelte`: Layout components
  - `src/lib/components/ui/`: Reusable UI components (card, dialog, sidebar, etc.)

- **Image Utilities** (`src/lib/images.ts`):
  - `getManifest()`: Returns full manifest
  - `getPhotoDays()`: Returns photo day array
  - `getSources()`: Generates srcset strings for `<picture>` elements

### Build Configuration

- **Adapter**: `@sveltejs/adapter-static` (static site generation)
- **Preprocessor**: `vitePreprocess()` for Svelte compilation
- **Tailwind**: v4 with `@tailwindcss/vite` plugin
- **Vitest**: Configured for both client (browser) and server (node) tests

## Important Notes

### System Requirements

**Sharp requires libvips to be installed:**

- macOS: `brew install vips`
- Debian/Ubuntu: `sudo apt-get install -y libvips`

Without libvips, Sharp won't work and image generation will fail.

### Content Location

Source images are expected in a parent directory: `../content/israel-2022` (relative to project root). This is because content is kept separate from the SvelteKit application. Adjust `--src` path if running from different locations.

### Cache Management

The `.images-cache.json` file tracks processed images by hash and mtime. If you modify `scripts/config.ts` or change quality settings, increment `CACHE_VERSION` in `generate-images.ts` to force regeneration of all images.

### Manifest-Only Regeneration

Use `bun run images:build -- --manifest-only=true` to rebuild the manifest without reprocessing images. Useful when only story content or metadata changes.

### Watch Mode Limitations

Watch mode (`--watch=true`) monitors source directory and regenerates on file changes. It's designed for development but requires manual restart if config changes.

### Blur Placeholder Behavior

The blur intensity seen in UI is controlled by CSS (`filter: blur(20px)` in components), not by the blur asset generation. The blur assets are just low-res LQIP images.

## Development Workflow

1. **Initial setup**: `bun install` + install libvips
2. **Add photos**: Place JPEGs in `../content/israel-2022/`
3. **Generate images**: `bun run images:build` (or use watch mode during dev)
4. **Start dev server**: `bun run dev`
5. **Make changes**: Edit Svelte components or add stories (markdown files)
6. **Test**: `bun run test` before committing
7. **Build production**: `bun run build`

## Testing Strategy

- **Unit tests** (`tests/unit/`): Test image script utilities in isolation
- **Integration tests** (`tests/integration/`): Test full image generation pipeline
- **E2E tests** (`tests/e2e-images/`): Playwright tests for image rendering
- **Vitest browser mode**: Tests Svelte components in real browser environment

Run specific test suites:

- `bun run test:unit:images`: Unit tests for image processing
- `bun run test:images`: Integration and E2E image tests

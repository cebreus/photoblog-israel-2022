## Project Overview

This project is a modern, multi-gallery photoblog built with SvelteKit and powered by Bun. The core architectural concept is the use of a `CONTENT_DIR` environment variable, which allows for managing multiple distinct galleries from a single codebase. Each gallery has its own content, configuration, and generated assets.

The project is structured into three main layers:

1.  **Content (`content/<gallery-name>`):** Contains the source files for each gallery, including high-resolution images and a `site.md` configuration file.
2.  **Public Files (`static/<gallery-name>`):** Contains the generated, publicly accessible files for each gallery, such as optimized images and favicons.
3.  **Application (`src/`):** The main SvelteKit application, which is shared across all galleries. It dynamically loads data based on the active gallery from specialized manifests in `src/data/<gallery-name>/`.

## Data Architecture ("Split & Link")

To prevent metadata loss and allow independent script execution, image data is split across several linked manifests:

- **`images.manifest.json`**: Core structural data (pixel metadata, variants, dimensions, basic EXIF).
- **`analysis.manifest.json`**: AI-generated metadata (`aestheticScore`, `sharpness`, `qualityBucket`, `phash`).
- **`embeddings.manifest.json`**: High-dimensional vector embeddings for similarity features.
- **`faces.manifest.json`**: Face detection details (`facesDetected`, bounding boxes, `peopleIds`).

These manifests are merged at build time and during runtime data loading to provide a unified `ImageEntry` to the frontend.

## Building and Running

The project uses a comprehensive set of scripts defined in `package.json` for development, building, and testing.

### Development

To run the development server for a specific gallery, use the corresponding `dev:*` script:

```bash
# Run the development server for the 'israel-2022' gallery
bun run dev:israel

# Run the development server for the 'egypt-2025' gallery
bun run dev:egypt
```

The `dev` command is an alias for `dev:egypt`. The development scripts use a `--manifestOnly` flag to speed up server startup by only recalculating the manifest without regenerating images.

### Building for Production

To build a specific gallery for production, use the `build:*` scripts:

```bash
# Build the 'israel-2022' gallery to the 'build-israel-2022/' directory
bun run build:israel

# Build the 'egypt-2025' gallery to the 'build-egypt-2025/' directory
bun run build:egypt
```

### Testing

The project has a multi-layered testing strategy:

- **Unit Tests:** `bun run test:unit`
- **Component Tests:** `CONTENT_DIR=egypt-2025 bun run vitest run --project client`
- **E2E Tests:** `bun run test:e2e`
- **All Tests:** `bun run test`

## Development Conventions

- **Linting and Formatting:** The project uses [Biome](https://biomejs.dev/) for linting and formatting.
  - `bun run lint`: Check for linting errors.
  - `bun run format`: Format the code.
- **Image Generation:** Image assets are generated via scripts in the `scripts/` directory. These are typically run automatically as part of the `dev` and `build` commands, but can also be run manually:
  - `bun run images:build`: Generate optimized images.
  - `bun run favicons:build`: Generate favicons.
- **Git Hooks:** The project uses Husky pre-commit hooks to enforce Bun native API usage (blocking synchronous Node.js I/O) and run lint-staged.

## Coding Guidelines

### 1. Bun Native APIs (CRITICAL)

This project runs on **Bun** and prioritizes performance.

- **File I/O:**
  - ❌ `fs.readFileSync(path)` → ✅ `await Bun.file(path).text()` (or `.arrayBuffer()`)
  - ❌ `fs.writeFileSync(path)` → ✅ `await Bun.write(path, data)`
  - ❌ `fs.existsSync(path)` → ✅ `await Bun.file(path).exists()`
- **Environment:**
  - ❌ `process.env.KEY` → ✅ `Bun.env.KEY`
- **Shell:**
  - ❌ `child_process.spawn` → ✅ `Bun.spawn`

### 2. Testing

- **Framework:** Vitest (`import { describe, it, expect } from "vitest"`)
- **Avoid:** Do NOT use `bun:test` imports.

### 3. Imports

- Sorted automatically by Prettier (`node:` -> `bun` -> third-party -> local).
- Do not manually sort.

### 4. Advanced Performance Patterns (Bun)

| Node.js / Libs (❌ AVOID)         | Bun (✅ USE)                     | Why?                                             |
| --------------------------------- | -------------------------------- | ------------------------------------------------ |
| `import fg from 'fast-glob'`      | `new Bun.Glob('**/*.ts').scan()` | Native C++ implementation, no V8 overhead.       |
| `JSON.parse(fs.readFileSync(..))` | `await Bun.file(..).json()`      | Direct buffer parsing, avoids string allocation. |
| `zlib.gzipSync(data)`             | `Bun.gzipSync(data)`             | Optimized native compression.                    |
| `crypto.createHash('md5')`        | `Bun.hash(data)`                 | **For non-crypto only**: 5-10x faster (Wyhash).  |
| `setTimeout(..., ms)`             | `Bun.sleep(ms)`                  | Cleaner syntax, native implementation.           |

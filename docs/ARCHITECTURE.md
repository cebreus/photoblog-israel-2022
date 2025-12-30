# Architektura projektu

> Multi-gallery fotoblog postavený na SvelteKit 5 + Bun runtime.

## Obsah

1. [Přehled](#1-přehled)
2. [Technologický stack](#2-technologický-stack)
3. [Architektura systému](#3-architektura-systému)
4. [Související dokumenty](#4-související-dokumenty)

## 1. Přehled

**Klíčový koncept:** Proměnná `CONTENT_DIR` řídí aktivní galerii → jedna kódová základna, více nezávislých galerií.

### Charakteristiky

| Vlastnost        | Popis                                              |
| ---------------- | -------------------------------------------------- |
| Multi-gallery    | `israel-2022`, `egypt-2025` … řízeno `CONTENT_DIR` |
| Image processing | Sharp → AVIF/WebP/JPEG varianty, LQIP placeholders |
| Static export    | Pre-rendered SSG, optimální SEO                    |
| Type-safe        | Kompletní TypeScript pokrytí                       |

## 2. Technologický stack

### Runtime & Build

| Nástroj                                   | Verze | Účel                      |
| ----------------------------------------- | ----- | ------------------------- |
| [Bun](https://bun.sh/)                    | -     | Runtime + package manager |
| [SvelteKit](https://kit.svelte.dev/)      | 2.43+ | Framework                 |
| [Vite](https://vitejs.dev/)               | 7.1+  | Build tool                |
| [Sharp](https://sharp.pixelplumbing.com/) | 0.33+ | Image processing          |

### Frontend

- **Svelte 5** (runes API)
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **bits-ui** (headless komponenty)

### Testing

- **Vitest** — Unit + Integration
- **Playwright** — E2E
- **Biome** — Linting/Formatting

## 3. Architektura systému

```mermaid
flowchart TB
    subgraph Content["📁 Content Layer"]
        PICS[pics/*.jpg]
        SITE[site.md]
        STORY[*.md stories]
    end

    subgraph Build["⚙️ Build Time"]
        GEN[generate-images.ts]
        EXIF[EXIF extraction]
        VARIANTS[Varianty: AVIF/WebP/JPEG]
        MANIFEST[Manifesty JSON]
    end

    subgraph App["🖥️ Application Layer"]
        ROUTES[SvelteKit routes]
        COMPONENTS[Svelte komponenty]
        STORES[Svelte 5 stores]
    end

    subgraph Output["📦 Build Output"]
        HTML[Pre-rendered HTML]
        ASSETS[Optimalizované obrázky]
    end

    PICS --> GEN
    SITE --> GEN
    STORY --> GEN
    GEN --> EXIF --> VARIANTS --> MANIFEST
    MANIFEST --> ROUTES
    ROUTES --> COMPONENTS
    COMPONENTS --> STORES
    ROUTES --> HTML
    VARIANTS --> ASSETS
```

### Split & Link manifesty

Metadata jsou rozdělena pro optimalizaci:

| Manifest                   | Obsah                            |
| -------------------------- | -------------------------------- |
| `images.manifest.json`     | Struktura, EXIF, sources         |
| `analysis.manifest.json`   | Sharpness, pHash, aestheticScore |
| `faces.manifest.json`      | Detekce tváří, peopleIds         |
| `embeddings.manifest.json` | CLIP vektory (768D)              |
| `people.manifest.json`     | Shlukované osoby                 |

## 4. Související dokumenty

### Struktura & Konfigurace

- [ARCH-STRUCTURE.md](./ARCH-STRUCTURE.md) — Adresářová struktura projektu
- [ARCH-CONFIG.md](./ARCH-CONFIG.md) — Konfigurační soubory (Vite, TS, Tailwind…)

### Datové toky

- [ARCH-DATA-FLOW.md](./ARCH-DATA-FLOW.md) — Manifesty, cache, runtime flow

### Implementace

- [ARCH-FEATURES.md](./ARCH-FEATURES.md) — Routing, stores, features
- [ARCH-COMPONENTS.md](./ARCH-COMPONENTS.md) — GUI komponenty (Svelte)

### Build & Deploy

- [ARCH-BUILD.md](./ARCH-BUILD.md) — Skripty, image pipeline, build proces
- [ARCH-DEPLOY.md](./ARCH-DEPLOY.md) — Deployment, CI/CD

### Development

- [ARCH-DEV.md](./ARCH-DEV.md) — Workflow, závislosti, testing

### Funkce

- [COLLAGE-EDITOR.md](./COLLAGE-EDITOR.md) — Editor koláží
- [PERSON-MANAGEMENT.md](./PERSON-MANAGEMENT.md) — Správa osob
- [SPECIAL-MEDIA.md](./SPECIAL-MEDIA.md) — Panoramata, sekvence, 360°
- [FACE-CLUSTERING.md](./FACE-CLUSTERING.md) — Detekce a shlukování tváří

---

_Poslední aktualizace: 2025-12-30_

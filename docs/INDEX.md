# Dokumentace (rozcestník)

> Primárně česky, specializované soubory zůstávají v EN pro LLM agenty.

## Začni zde

- [README.md](../README.md) — krátký onboarding, `CONTENT_DIR`, rychlý start, features 2026.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — přehled architektury, tech stack, subsystémy.

## Architektura a struktura

- [ARCH-STRUCTURE.md](./ARCH-STRUCTURE.md) — mapa adresářů, 20 API endpointů.
- [ARCH-DATA-FLOW.md](./ARCH-DATA-FLOW.md) — datové struktury (ImageEntry, Separator, PhotoDay, SequenceInfo).
- [ARCH-BUILD.md](./ARCH-BUILD.md) — build pipeline, image processing, Sharp config.
- [ARCH-DEV.md](./ARCH-DEV.md) — dev workflow, lokální setup, debugging.
- [ARCH-COMPONENTS.md](./ARCH-COMPONENTS.md) — hierarchie komponent, Svelte 5 runes, stores.
- [**STORES.md**](./STORES.md) — Module-level $state pattern, core stores (filters, selection, manifest).
- [ARCH-FEATURES.md](./ARCH-FEATURES.md) — 9 sekčí: Routing, Stores, Filtrace, **Separátory**, **Sekvence**, **Řazení**, Editační režim, **CLAP**, Kurátorství.
- [ARCH-CONFIG.md](./ARCH-CONFIG.md) — konfigurace (Vite, Tailwind, Biome, TypeScript).
- [ARCH-DEPLOY.md](./ARCH-DEPLOY.md) — deployment, Docker, environment variables.

## API a komponenty (NOVÉ!)

- [**API-REFERENCE.md**](./API-REFERENCE.md) — Kompletní API dokumentace:
  - Image management (DELETE, POST, PATCH)
  - Sorting & reordering (reorder, swap-time, redistribute)
  - People management (9 endpointů)
  - Collage management
  - Utilities (geocode, logging, file proxy, system events SSE)

- [**COMPONENT-REFERENCE.md**](./COMPONENT-REFERENCE.md) — Svelte komponenty:
  - PhotoGrid, PhotoGridSeparator, SequencePlayer
  - ClapEditor, AspectRatioPicker, ReorderMode
  - People components, utilities

## Skripty a build

- [SCRIPTS.md](./SCRIPTS.md) — CLI příkazy (manage.ts pattern: `process:images`, `process:blur`, etc.).
- [ADD-GALLERY.md](./ADD-GALLERY.md) — postup přidání nové galerie.
- [SCRIPTS.md](./SCRIPTS.md) — seznam skriptů s dokumentací.

## Testování a kvalita

- [TESTING.md](./TESTING.md) — strategie testů, 6 Vitest projektů, Playwright E2E.
- [CODE-QUALITY.md](./CODE-QUALITY.md) — lint (Biome), formátování (Prettier), type-check.
- [LOGGING.md](./LOGGING.md) — strukturované logování (Pino), wide events, E2E trasování.

## Maintenance (NOVÉ!)

- [**BREAKING_CHANGES.md**](./BREAKING_CHANGES.md) — Verze 2026-01:
  - Logger interface (Pino)
  - EXIF fields now required
  - Separátory: Markdown-driven
  - Sekvence: 10-minute detection
  - CLAP: HEIC crop metadata
  - Svelte 5 $state runes
  - Migration checklist

## Specializované funkce

- [PERSON-MANAGEMENT.md](./PERSON-MANAGEMENT.md) — správa osob, clustering, avatary.
- [FACE-CLUSTERING.md](./FACE-CLUSTERING.md) — detekce a shlukování tváří.
- [SEPARATOR_ARCHITECTURE_ANALYSIS.md](./SEPARATOR_ARCHITECTURE_ANALYSIS.md) — Separator systém deep dive.
- [SPECIAL-MEDIA.md](./SPECIAL-MEDIA.md) — video, GIF, panorama.
- [COLLAGE-EDITOR.md](./COLLAGE-EDITOR.md) — kolážový editor.
- [INTERACTIVITY.md](./INTERACTIVITY.md) — lightbox, modály, interakce.

## Pro LLM agenty (EN)

- [GEMINI.md](../GEMINI.md) — Google agent rules (Bun-first, logging, format→check).
- [CLAUDE.md](../CLAUDE.md) — Anthropic agent rules (stejná sada guardrails).

---

Poslední aktualizace: 2026-01-06

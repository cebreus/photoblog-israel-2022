# Fotoblog | Multi-gallery SvelteKit

Moderní fotoblog s podporou více galerií z jediné kódové základny. Postaveno na SvelteKit, Bun a Svelte 5.

**Aktualizace 2026:** Separátory (Markdown-driven), Sekvence (10-min grouping), ReleaseDate sorting (XMP persistent), CLAP (HEIC crop), vylepšené filtry.

## Klíčový koncept: Multi-gallery s CONTENT_DIR

Celý systém je řízen proměnnou `CONTENT_DIR`, která určuje aktivní galerii pro vývoj, build nebo generování assetů.

```
# Příklad: práce s galerií Egypt 2025
CONTENT_DIR=egypt-2025 bun run images:build

# Příklad: práce s galerií Israel 2022
CONTENT_DIR=israel-2022 bun run dev
```

Každá galerie má vlastní obsah v `content/<galerie>/`, generované assety ve `static-<gallery>/` a manifesty v `src/data/<galerie>/`.

## Požadavky

- Bun (runtime + správce balíčků)
- libvips (pro Sharp) — např. `brew install vips`
- ExifTool (pro metadata) — např. `brew install exiftool`

## Rychlý start

### Instalace

```
bun install
```

### Vývoj

```
# Interaktivní výběr galerie (doporučeno)
bun run dev

# Přímo s galerií
bun run dev -- -g egypt-2025
bun run dev -- -g israel-2022
```

### Build

```
bun run build                 # Interaktivní výběr
bun run build -- -g egypt-2025   # Konkrétní galerie
```

### Testy

```
bun run test                     # Všechny testy
bun run test:unit                # Unit
CONTENT_DIR=egypt-2025 bun run vitest run --project client  # Component (vyžaduje CONTENT_DIR)
```

## Kde dál

- Rozcestník: docs/INDEX.md
- Architektura: docs/ARCHITECTURE.md
- Příkazy: docs/SCRIPTS.md
- Přidání galerie: docs/ADD-GALLERY.md
- Testování: docs/TESTING.md
- CLAP editor (HEIC crop): docs/CLAP-EDITOR.md

## Technologie

- Runtime: Bun
- Framework: SvelteKit 2 + Svelte 5 (runes)
- Styling: Tailwind CSS v4
- Obrázky: Sharp (libvips)
- Testy: Vitest + Playwright
- Lint/format: Biome, Prettier, Stylelint

---

Poslední aktualizace: 2026-01-05

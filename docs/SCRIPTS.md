# Kompletní seznam skriptů

Tento dokument obsahuje referenční příručku všech skriptů dostupných v `package.json`. Většina příkazů využívá sjednocený CLI nástroj (`scripts/manage.ts`), který umožňuje interaktivní výběr galerie nebo použití argumentů.

## Obsah

- [Kompletní seznam skriptů](#kompletní-seznam-skriptů)
  - [Obsah](#obsah)
  - [Development](#development)
  - [Build (produkce)](#build-produkce)
  - [Generování assetů](#generování-assetů)
    - [Image processing](#image-processing)
    - [Manifest skripty](#manifest-skripty)
    - [Favicon generation](#favicon-generation)
    - [Kompletní generování](#kompletní-generování)
    - [Similarity analysis](#similarity-analysis)
  - [Testování](#testování)
  - [Code quality](#code-quality)
  - [Utility](#utility)
  - [Poznámky](#poznámky)
    - [Proměnné prostředí](#proměnné-prostředí)
    - [Běžné workflow](#běžné-workflow)

## Development

Vývojové servery. Doporučujeme používat interaktivní režim.

- **`bun run dev`** - Spustí interaktivní výběr galerie a následně dev server.
- **`bun run dev -- -g egypt-2025`** - Spustí přímo pro konkrétní galerii.

### Legacy aliasy

- **`bun run dev:israel`** - Alias pro `bun run dev -- -g israel-2022`
- **`bun run dev:egypt`** - Alias pro `bun run dev -- -g egypt-2025`
- **`bun run preview`** - Náhled production buildu lokálně

## Build (produkce)

Build celého webu pro deployment.

- **`bun run build`** - Interaktivní výběr galerie.
- **`bun run build -- -g egypt-2025`** - Build pro konkrétní galerii.

## Generování assetů

Skripty pro manuální generování obrázků, manifestů a favicon. Používají proměnnou `CONTENT_DIR` pro určení aktivní galerie.

### Kompletní pipeline (Process)

Kompletní pipeline pro zpracování dat (obrázky -> AI -> favicons).

- **`bun run process`** - Interaktivní výběr.
- **`bun run process -- -g egypt-2025`** - Spustí pipeline pro konkrétní galerii.

### Image processing

- **`bun run images:build`** - Vygeneruje všechny varianty obrázků pro výchozí galerii
- **`bun run images:build:israel`** - Pro Israel 2022
- **`bun run images:build:egypt`** - Pro Egypt 2025

  **Podporované flagy:**
  - `--manifestOnly` - Pouze regenerace manifestu (bez přegenerování obrázků)
  - `--curation` - Generování kurátorského manifestu s detekcí duplikátů
  - `--watch` - Watch režim pro automatickou regeneraci
  - `--clean` - Odstranění osiřelých souborů po buildu
  - `--limit=<n>` - Omezení počtu zpracovaných obrázků (pro testování)
  - `--concurrency=<n|auto>` - Nastavení paralelního zpracování

  **Příklady použití:**

  ```bash
  bun run images:build:israel                  # Základní použití
  CONTENT_DIR=israel-2022 bun run images:build # Alternativa s proměnnou
  bun run images:build --manifestOnly          # Pouze manifest
  bun run images:build --curation              # S kurátorským režimem
  bun run images:build --watch                 # Watch režim
  ```

- **`bun run images:watch`** - Watch režim, automatická regenerace při změnách v content/
- **`bun run images:blur`** - Vygeneruje pouze blur placeholders (LQIP)
- **`bun run images:blur:israel`** - Blur pro Israel 2022
- **`bun run images:blur:egypt`** - Blur pro Egypt 2025
- **`bun run images:all`** - Kompletní generování: všechny varianty + blur placeholders

### Manifest skripty

- **`bun run manifest:build:israel`** - Rychlá regenerace pouze manifestu pro Israel 2022
- **`bun run manifest:build:egypt`** - Rychlá regenerace pouze manifestu pro Egypt 2025
- **`bun run manifest:curation:israel`** - Generování kurátorského manifestu pro Israel 2022 (s detekcí duplikátů)
- **`bun run manifest:curation:egypt`** - Generování kurátorského manifestu pro Egypt 2025

### Face Clustering

- **`bun run faces:cluster:israel`** - Sdružování obličejů pro Israel 2022
- **`bun run faces:cluster:egypt`** - Sdružování obličejů pro Egypt 2025

### Favicon generation

- **`bun run favicons:build`** - Vygeneruje favicons a PWA manifest pro výchozí galerii
- **`bun run favicons:build:israel`** - Vygeneruje favicons pro Israel 2022
- **`bun run favicons:build:egypt`** - Vygeneruje favicons pro Egypt 2025

### Kompletní generování

- **`bun run generate`** - Vygeneruje obrázky i favicons pro výchozí galerii

### Similarity analysis

- **`bun run analyze:israel`** - Analýza podobnosti fotografií pro Israel 2022 (perceptual hashing)
- **`bun run analyze:egypt`** - Analýza podobnosti fotografií pro Egypt 2025

## Testování

Kompletní testovací strategie zahrnující unit, component, integration a E2E testy.

- **`bun run test`** - Spustí všechny testy (unit + integration + E2E)
- **`bun run test:unit`** - Spustí unit testy v watch režimu

  **Varianty:**

  ```bash
  bun run vitest run                                     # Jednorázový běh
  CONTENT_DIR=egypt-2025 bun run vitest run --project client  # Component testy
  ```

- **`bun run test:integration`** - Spustí integration testy pro image processing pipeline
  > **Poznámka:** Používá `SHARP_NUM_THREADS=1` pro deterministické výstupy
- **`bun run test:e2e`** - Spustí E2E testy pomocí Playwright

**Více informací:** [TESTING.md](./TESTING.md)

## Code quality

Linting, formátování a type-checking pomocí Biome, Prettier, Stylelint a svelte-check.

- **`bun run lint`** - Kontrola kódu pomocí Biome a Stylelint
- **`bun run lint:css`** - Kontrola CSS souborů pomocí Stylelint
- **`bun run lint:fix`** - Automatická oprava problémů nalezených Biome
- **`bun run lint:ci`** - Linting pro CI/CD (summary report, warnings)
- **`bun run format`** - Naformátuje kód pomocí Biome a Prettier
  - **Biome:** TypeScript, JavaScript
  - **Prettier:** Svelte, Markdown, HTML, CSS
- **`bun run format:check`** - Kontrola formátování bez zápisu
- **`bun run check`** - TypeScript type-checking pro Svelte komponenty
- **`bun run check:watch`** - Type-checking v watch režimu

## Utility

- **`bun run prepare`** - SvelteKit synchronizace (generování typů, cest). Spouští se automaticky při instalaci

## Poznámky

### Proměnné prostředí

- **`CONTENT_DIR`**: Určuje aktivní galerii (např. `israel-2022`, `egypt-2025`)
- **`OUTPUT_DIR`**: Cílový adresář pro production build (výchozí: `build/`)
- **`SHARP_NUM_THREADS`**: Počet vláken pro Sharp (nastavte na `1` pro deterministické výstupy)

### Běžné workflow

**Vývoj:**

```bash
bun run dev:egypt
```

**Přidání nových fotek:**

```bash
# Přidat JPEG do content/<galerie>/pics/
# Pak:
CONTENT_DIR=egypt-2025 bun run images:build
```

**Production build:**

```bash
bun run build:egypt
```

**Testování před commitem:**

```bash
bun run lint
bun run check
bun run test
```

Pro podrobnosti o architektuře a implementaci viz:

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailní architektura projektu
- [TESTING.md](./TESTING.md) - Testovací strategie
- [ADD-GALLERY.md](./ADD-GALLERY.md) - Návod na přidání nové galerie

## Troubleshooting

### Problémy s AI Skripty (Bun + Native Addons)

Pokud při spouštění skriptů `faces:cluster` nebo `analyze` narazíte na chyby týkající se chybějících `.node` souborů (např. `tfjs_binding.node` nebo `canvas.node`), je to způsobeno nekompatibilitou mezi Bun, pnpm a nativními moduly.

**Řešení pro `tfjs-node`:**

```bash
# 1. Najděte adresář balíčku
# (Cesta se může lišit podle verze pnpm, hledejte v node_modules/.pnpm/)
cd node_modules/.pnpm/@tensorflow+tfjs-node@*/node_modules/@tensorflow/tfjs-node

# 2. Spusťte manuální build pomocí node-pre-gyp (absolutní cestou)
# Upravte cestu k node-pre-gyp podle vaší instalace (často v root node_modules/.bin)
../../../../../../node_modules/.bin/node-pre-gyp install --fallback-to-build
```

**Řešení pro `canvas`:**

```bash
# 1. Najděte adresář balíčku
cd node_modules/.pnpm/canvas@*/node_modules/canvas

# 2. Spusťte rebuild
npm rebuild
```

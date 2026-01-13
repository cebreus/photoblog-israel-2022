# Kompletní seznam skriptů

Tento dokument obsahuje referenční příručku všech skriptů dostupných v `package.json`. Většina příkazů využívá sjednocený CLI nástroj (`scripts/manage.ts`), který umožňuje interaktivní výběr galerie nebo použití argumentů.

**Navigace:** [← INDEX](./INDEX.md) | [ARCH-BUILD →](./ARCH-BUILD.md) | [TESTING →](./TESTING.md)

## Obsah

- [Kompletní seznam skriptů](#kompletní-seznam-skriptů)
  - [Obsah](#obsah)
  - [Development](#development)
  - [Build (produkce)](#build-produkce)
  - [Generování assetů (Process pipeline)](#generování-assetů-process-pipeline)
  - [Testování](#testování)
  - [Code quality](#code-quality)
  - [Utility skripty](#utility-skripty)
  - [Cache Systém](#cache-systém)
    - [Struktura cache a manifestů](#struktura-cache-a-manifestů)
    - [Jak cache funguje](#jak-cache-funguje)
    - [Split Manifest Architektura](#split-manifest-architektura)
    - [Pipeline kroky (`pnpm process`)](#pipeline-kroky-pnpm-process)
    - [Co běží při `pnpm dev`](#co-běží-při-pnpm-dev)
  - [Poznámky](#poznámky)
    - [Proměnné prostředí](#proměnné-prostředí)
    - [Běžné workflow](#běžné-workflow)
  - [Troubleshooting](#troubleshooting)
    - [Problémy s AI Skripty (Bun + Native Addons)](#problémy-s-ai-skripty-bun--native-addons)
    - [Optimization Notes: upng-js vs Sharp](#optimization-notes-upng-js-vs-sharp)
    - [Nové CLI Flagy](#nové-cli-flagy)
      - [`--detect-renames` (experimentální)](#--detect-renames-experimentální)
      - [`--clean-outputs` (validátor)](#--clean-outputs-validátor)
    - [Budoucí Optimalizace](#budoucí-optimalizace)
      - [Face Detection Architektura (záměrně odděleno)](#face-detection-architektura-záměrně-odděleno)
  - [Související dokumenty](#související-dokumenty)

## Development

Vývojové servery. Doporučujeme používat interaktivní režim.

- **`bun run dev`** — Spustí interaktivní výběr galerie a následně dev server
- **`bun run preview`** — Náhled production buildu lokálně

## Build (produkce)

Build celého webu pro deployment.

- **`bun run build`** — Interaktivní výběr galerie. Spouští i `paraglide-js compile`.

## Generování assetů (Process pipeline)

Unified CLI pro zpracování dat přes `scripts/manage.ts`. Všechny příkazy podporují:

- `--gallery`, `-g` — Cílová galerie (např. `egypt-2025`, `israel-2022`)
- `--verbose`, `-v` — Detailní logování
- `--clean` — Smazání výstupu před procesem
- `--manifest-only` — Rychlá aktualizace manifestu (EXIF + .md, bez analýzy)
- `--concurrency` — Počet paralelních úloh
- `--limit` — Omezení počtu zpracovaných obrázků

**Kompletní pipeline:**

- **`bun run process`** — Kompletní pipeline (images → blur → analysis → faces → favicons)

**Dílčí kroky:**

- **`bun run process:images`** — Generování image variant (AVIF, WebP, JPEG)
- **`bun run process:blur`** — Generování LQIP blur placeholders
- **`bun run process:analysis`** — AI analýza (sharpness, perceptual hash, aesthetic score)
- **`bun run process:faces`** — Face detection a clustering
- **`bun run process:favicons`** — Generování faviconů a PWA manifestu

**Příklady:**

```bash
bun run dev                                # Interaktivní výběr
bun run dev -- -g egypt-2025               # Přímé spuštění
bun run process -- -g israel-2022 --clean  # Kompletní pipeline s clean
bun run process:images -- --manifest-only  # Rychlá regenerace manifestu
```

## Testování

**Unit & Integration testy:**

- **`bun run test`** — Všechny testy (unit + integration)
- **`bun run test:unit`** — Pouze unit testy (core + DOM)
- **`bun run test:integration`** — Pouze integration testy (API + build + data, s `SHARP_NUM_THREADS=1`)
- **`bun run test:coverage`** — Testy s code coverage reportem

**E2E testy:**

- **`bun run test:e2e`** — Playwright end-to-end testy

**Více informací:** [TESTING.md](./TESTING.md)

## Code quality

- **`bun run lint`** — Kontrola kódu (Prettier + Stylelint + Biome)
- **`bun run format`** — Automatická oprava formátování
- **`bun run lint:ci`** — Linting pro CI (s diagnostic-level=warn)
- **`bun run lint-staged`** — Pre-commit hook (pouze staged soubory)
- **`bun run check`** — TypeScript type-checking pro Svelte komponenty
- **`bun run check:watch`** — Type-checking v watch režimu

## Utility skripty

**Image management:**

- **`bun run images:rename`** — Interaktivní hromadné přejmenování fotek podle metadat
- **`bun run images:rename:revert`** — Vrácení změn z `images:rename` (vyžaduje JSON plán)
- **`bun run images:underwater`** — Fix underwater images (speciální úpravy)

**Face & people auditing:**

- **`bun run faces:cluster`** — Face clustering a people management
- **`bun run faces:audit`** — Audit orphaned faces a consistency check

**Person Normalization & Maintenance:**

- **`bun run scripts/normalize-by-category.ts`** — Sjednotí ID podle kategorií (převede `osoba-`/`socha-` na `person-`/`statue-`).
- **`bun run scripts/normalize-named-people.ts`** — Zajistí správný formát pro pojmenované osoby (`person-<slug>-<hash>`).
- **`bun run scripts/normalize-person-names.ts`** — Sjednotí generická jména (`Person 001`).
- **`bun run scripts/fix-person-format.ts`** — Opraví staré formáty a obnoví hashe ze záloh.

**Cleanup:**

- **`bun run clean`** — Vymaže build výstupy a manifesty
- **`bun run clean:all`** — Vymaže vše (build, cache, generované obrázky)

**Maintenance:**

- **`bun run prepare`** — SvelteKit synchronizace (generování typů, cest, spouští se automaticky při instalaci)

**Debugging & Tracing:**

- **`bun run scripts/log-to-trace.ts`** — Konvertuje JSON logy na formát Trace Events (vizualizace výkonu).
  - `-f`, `--file <path>` — Vstupní log soubor (default: `logs/dev.log`)
  - `-o`, `--out <path>` — Výstupní JSON (default: `trace.json`)
  - `-i`, `--id <id>` — Filtrovat pouze události pro konkrétní RequestID nebo TraceID
  - **Použití:** Výstupní soubor otevřete v [ui.perfetto.dev](https://ui.perfetto.dev) nebo `chrome://tracing`.

## Cache Systém

Projekt používá vícevrstvý cache systém pro efektivní inkrementální buildy.

### Struktura cache a manifestů

```
.temp/<gallery>/
└── images.cache.json          # Hash-based build cache

src/data/<gallery>/
├── images.manifest.json       # Hlavní manifest (struktura, EXIF, sources)
├── analysis.manifest.json     # AI analýza (sharpness, phash, aestheticScore, qualityBucket)
├── embeddings.manifest.json   # CLIP vektory (768D) pro podobnost
├── faces.manifest.json        # Detekce tváří (bounding boxy, peopleIds, descriptors)
├── people.manifest.json       # Shlukované osoby + ruční úpravy
├── menu.manifest.json         # Navigační struktura
└── site.manifest.json         # Metadata galerie (z site.md)
```

### Jak cache funguje

1. **Při spuštění buildu** se načte `images.cache.json`:

   ```typescript
   type Cache = {
     version: number; // Verze cache schématu (CACHE_VERSION = 17)
     configHash: string; // SHA1 hash build konfigurace
     files: {
       [relativePath: string]: {
         hash: string; // SHA1 hash obsahu souboru
         mtimeMs: number; // Čas modifikace souboru
         outputs: string[]; // Seznam vygenerovaných variant
       };
     };
   };
   ```

2. **Detekce změn** (`detectChanges`):
   - Pro každý soubor na disku se porovná `mtimeMs` s cache
   - Pokud se liší nebo soubor není v cache → přidat do `toProcess`
   - Pokud soubor chybí na disku ale je v cache → přidat do `toDelete`

3. **Detekce ghost záznamů** (`detectGhostManifestEntries`):
   - Porovná záznamy v manifestu s fyzickými soubory
   - Záznamy bez odpovídajících souborů → přidat do `toDelete`
   - Toto řeší situaci, kdy soubor byl smazán a cache byla vymazána

4. **Invalidace cache**:

   Cache se automaticky invaliduje při:
   - Změně `CACHE_VERSION` v `generate-images.ts` (aktuálně 17)
   - Změně konfigurace v `build.config.ts` (detekováno přes `configHash`)
   - Změně `mtimeMs` zdrojového souboru

### Split Manifest Architektura

Pro optimalizaci velikosti a nezávislé aktualizace jsou metadata rozdělena do několika manifestů:

| Manifest                   | Obsah                                           | Kdy se aktualizuje           |
| -------------------------- | ----------------------------------------------- | ---------------------------- |
| `images.manifest.json`     | Struktura, EXIF, sources, PhotoDays             | Step 2 (Image Variants)      |
| `analysis.manifest.json`   | sharpness, phash, aestheticScore, qualityBucket | Step 2 + Step 3              |
| `embeddings.manifest.json` | 768D CLIP vektory                               | Step 3 (Similarity Analysis) |
| `faces.manifest.json`      | bounding boxy, peopleIds, descriptors           | Step 2 + Step 4              |
| `people.manifest.json`     | Person clusters, jména, kategorie               | Step 4 (Face Clustering)     |

### Pipeline kroky (`pnpm process`)

```
Step 1: Favicons
├── Vstup: content/<gallery>/favicons-source.png
└── Výstup: static-<gallery>/assets/favicons/

Step 2: Image Variants (--skipEmbeddings)
├── Vstup: content/<gallery>/pics/*.{jpg,heic,png}
├── Zpracování:
│   ├── Resize: default (370px), xl (534px), detail (1280px), fallback (190px)
│   ├── Formáty: AVIF, WebP, JPEG
│   ├── LQIP blur placeholders (24px)
│   ├── EXIF extraction
│   ├── Sharpness score
│   ├── pHash (perceptual hash)
│   ├── Dominant color (CSS rgb())
│   └── Face detection (SSD MobileNet) - pro smart cropping
└── Výstup: static-<gallery>/images/*, manifesty

Step 3: Similarity & Aesthetic Analysis
├── checkManifest(true) - s curation flag
│   └── Generuje CLIP embeddings (768D vektory)
└── analyze-similarity.ts
    ├── Počítá aestheticScore (kosinová podobnost)
    ├── Kvalitativní bucket (excellent/good/poor)
    └── Detekuje duplikáty (time-window grouping)

Step 4: Face Clustering
├── Vstup: detail JPEG varianty (1280px)
├── Zpracování:
│   ├── Face detection (face-api.js)
│   ├── 128D face embeddings
│   ├── Euclidean distance clustering
│   └── Face crops do static-<gallery>/faces/
└── Výstup: people.manifest.json, faces.manifest.json

Step 5: Manifest Validation
├── Validace konzistence split manifestů
│   ├── Odstranění ghost záznamů z analysis/embeddings/faces
│   └── Vyčištění orphaned references z people.manifest
├── Cleanup orphaned assets
│   ├── Face crops pro smazané osoby
│   └── Prázdné adresáře
└── Výstup: Vyčištěné manifesty + freed disk space
```

### Co běží při `pnpm dev`

```
pnpm dev
├── checkManifest(false)  # --manifestOnly --quiet
│   ├── Načte pouze EXIF metadata
│   ├── PŘESKAKUJE: sharpness, pHash, dominantColor, face detection, embeddings
│   └── Čas: ~150ms
├── cmdFavicons()
└── vite dev
```

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

- [INDEX.md](./INDEX.md) — Rozcestník dokumentace
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Detailní architektura projektu
- [ARCH-BUILD.md](./ARCH-BUILD.md) — Build proces a pipeline
- [TESTING.md](./TESTING.md) — Testovací strategie
- [ADD-GALLERY.md](./ADD-GALLERY.md) — Návod na přidání nové galerie
- [CODE-QUALITY.md](./CODE-QUALITY.md) — QA nástroje a workflow

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

### Optimization Notes: upng-js vs Sharp

We attempted to optimize the file size of generated blurred placeholders (LQIP) using the `upng-js` library, which is generally known for better PNG compression. However, benchmarks on our specific dataset (very small 24px wide images) showed that `upng-js` actually **increased** the file size by approximately 40-80% compared to our tuned `sharp` settings.

**Benchmark Results (Sample):**

- **Sharp**: ~306 bytes/image
- **UPNG.js**: ~430 bytes/image

For this reason, `upng-js` implementation was reverted and we continue to use `sharp` with the following settings:

```javascript
{
  palette: true,
  colors: 32,
  quality: 50,
  compressionLevel: 9
}
```

**Decision:** Do not attempt to re-implement `upng-js` for this specific use case unless a significant change in requirements or library performance occurs.

### Nové CLI Flagy

#### `--detect-renames` (experimentální)

Detekuje přejmenování souborů porovnáním content hashů. Místo zpracování jako "smazaný + nový" migruje všechny reference.

```bash
pnpm process --detect-renames
```

**Jak to funguje:**

1. Spočítá SHA-256 hash prvních 64KB každého nového souboru
2. Porovná s uloženými hashy v `.temp/<gallery>/content-hashes.json`
3. Pokud najde shodu s jiným názvem → migrace místo regenerace

#### `--clean-outputs` (validátor)

Při spuštění Step 5 (Manifest Validation) vyčistí i osiřelé output soubory (previews, details).

```bash
# V manage.ts - prozatím není exponováno jako CLI flag
# Lze aktivovat modifikací volání validateAndCleanManifests(dataDir, false, true)
```

### Budoucí Optimalizace

#### Face Detection Architektura (záměrně odděleno)

Step 2 a Step 4 používají **různé modely** z důvodu optimalizace:

| Krok   | Modely                                 | Velikost | Účel                               |
| ------ | -------------------------------------- | -------- | ---------------------------------- |
| Step 2 | SSD MobileNet                          | ~5 MB    | Pouze bounding boxy pro smart crop |
| Step 4 | SSD + FaceLandmark68 + FaceRecognition | ~100 MB  | Landmarky + 128D descriptors       |

**Proč jsou oddělené:**

1. **Memory footprint** - Step 2 běží na všech obrázcích
2. **Rychlost** - Landmarky + recognition jsou ~5x pomalejší
3. **Nezávislost** - Step 4 je volitelný, Step 2 je povinný

**Potenciální optimalizace (složitá implementace):**

- Sdílený singleton pro face-api modely
- Lazy loading recognition modelů pouze při prvním clusteru
- Úspora: ~500ms/obrázek, ale vyžaduje refaktoring inicializace

**Důvod odložení:** Současná architektura je záměrně oddělená pro izolaci memory footprintu a nezávislost kroků.

## Související dokumenty

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled architektury
- [ARCH-BUILD.md](./ARCH-BUILD.md) — Build proces
- [TESTING.md](./TESTING.md) — Testovací strategie
- [ADD-GALLERY.md](./ADD-GALLERY.md) — Přidání nové galerie

---

_Poslední aktualizace: 2026-01-12_

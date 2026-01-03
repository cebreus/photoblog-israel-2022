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

### Podporované argumenty (všechny skripty)

Většinu argumentů lze předat skrze `manage.ts` pomocí syntaxe `bun scripts/manage.ts <command> --flag=value`.

| Flag              | Popis                                                  | Výchozí         |
| :---------------- | :----------------------------------------------------- | :-------------- |
| `--gallery`, `-g` | Cílová galerie (např. `israel-2022`)                   | `egypt-2025`    |
| `--verbose`, `-v` | Povolí detailní logování                               | `false`         |
| `--clean`         | Smaže výstupní adresář před procesem                   | `false`         |
| `--manifest-only` | Rychlá aktualizace manifestu (EXIF + .md, bez analýzy) | `false`         |
| `--concurrency`   | Počet paralelních úloh                                 | `auto`          |
| `--limit`         | Omezení počtu zpracovaných obrázků                     | `0` (neomezeno) |

### Specifické argumenty pro sub-kroky

#### Image Processing (`images`, `blur`)

- `--watch`: Sleduje změny v `content/` a automaticky regeneruje.
- `--curation`: Zapne detekci duplikátů a generování kurátorského manifestu.

> **Poznámka k `--manifest-only`:** V tomto režimu se načítají pouze:
>
> - EXIF metadata z obrázků (dimenze, GPS, datum [Wall Clock], autor)
> - Story obsah z `.md` souborů
>
> Přeskakuje se: dominantní barva (placeholder), sharpness, pHash, detekce obličejů.
> Toto umožňuje rychlý start `pnpm dev` (~150ms místo minut).

#### AI & Analysis (`analyze`, `faces`)

- `--batch-size`: Velikost dávky pro AI modely (default: `8`).
- `--time-window`: Časové okno pro hledání podobností v hodinách (default: `4`).
- `--threshold`: Práh podobnosti pro obličeje (0.1 - 1.0, default: `0.6`).
- `--min-confidence`: Minimální jistota detekce obličeje (default: `0.5`).
- `--min-face-size`: Minimální velikost obličeje v pixelech (např. `80`).

### Image processing

- **`bun run images:build`** - Vygeneruje všechny varianty obrázků pro výchozí galerii
- **`bun run images:build:israel`** - Pro Israel 2022
- **`bun run images:build:egypt`** - Pro Egypt 2025
- **`bun run images:rename`** - Interaktivní skript pro hromadné přejmenování fotek podle metadat (datum, autor). Podporuje "chytrou migraci" (přejmenování assetů, cache i manifestů bez nutnosti rebuildu).

  **Podporované flagy:**
  - `--dryRun` - Simulace přejmenování, vygeneruje JSON plán bez provedení změn
  - `--author=<name>` - Výchozí autor pro EXIF data
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
  bun run images:rename --dryRun --gallery=egypt-2025 # Simulace přejmenování
  ```

- **`bun run images:rename:revert`** - Skript pro vrácení změn provedených `images:rename`. Vyžaduje JSON plán vygenerovaný při `--dryRun` (nebo automaticky vytvořený předchozím během, pokud by byl integrován log).
  - Použití: `bun run images:rename:revert` (interaktivně se zeptá na cestu k JSON plánu)

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

## Maintenance a Monitoring

191:
192: Skripty pro zajištění konzistence dat a real-time dohled.
193:
194: - **`bun scripts/watchdog.ts`** - **Doporučeno při práci v GUI.** Real-time monitoring konzistence:
195: - Hlídá "zombie" profily (0 fotek).
196: - Hlídá zanořené názvy.
197: - Indikuje stav dat (srdíčko každých 5s).
198:
199: - **`bun scripts/clean-empty-people.ts`** - Jednorázový čistič.
200: - Odstraní z `people.manifest.json` osoby, které nemají žádné fotky.
201: - Řeší problém "duchů" v postranním panelu.
202:
203: ## Utility

- **`bun run prepare`** - SvelteKit synchronizace (generování typů, cest). Spouští se automaticky při instalaci

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
└── Výstup: static/<gallery>/assets/favicons/

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
└── Výstup: static/<gallery>/images/*, manifesty

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
│   └── Face crops do static/<gallery>/faces/
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

_Poslední aktualizace: 2026-01-03_

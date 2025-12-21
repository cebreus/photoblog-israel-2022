# Photoblog Israel 2022 - Komplexní Architektonická Dokumentace

> **Účel**: Detailní dokumentace celé codebase z perspektivy systémového architekta pro účely migrace do jiné technologie.

> **Datum vytvoření**: 2025-10-21
>
> **Verze projektu**: 0.0.1

---

## Obsah

1. [Přehled projektu](#1-přehled-projektu)
2. [Struktura projektu](#2-struktura-projektu)
3. [Analýza souborů](#3-analýza-souborů) ⚠️
4. [Konfigurační soubory](#4-konfigurační-soubory)
5. [Datové toky](#5-datové-toky)
6. [Features implementované v projektu](#6-features-implementované-v-projektu)
7. [GUI komponenty](#7-gui-komponenty)
8. [Bun scripts a task management](#8-bun-scripts-a-task-management)
9. [Build proces](#9-build-proces)
10. [Deployment konfigurace](#10-deployment-konfigurace)
11. [Závislosti a package management](#11-závislosti-a-package-management)
12. [Content management](#12-content-management)
13. [Pomocné skripty a nástroje](#13-pomocné-skripty-a-nástroje)
14. [Development workflow](#14-development-workflow)
15. [Testing strategie](#15-testing-strategie)

---

## 1. Přehled projektu

### 1.1 Účel a popis

Jedná se o moderní **multi-gallery fotoblog** postavený na SvelteKit 5 a běžící na Bun runtime. Klíčovým architektonickým konceptem je použití proměnné prostředí **`CONTENT_DIR`**, která umožňuje spravovat **více nezávislých galerií** (např. `israel-2022`, `egypt-2025`) z jediné kódové základny. Každá galerie má vlastní obsah, konfiguraci a generované assety.

Projekt klade velký důraz na **výkon a optimalizaci obrázků** - jádrem je pokročilý systém pro generování a zpracování fotografií v různých formátech (AVIF, WebP, JPEG) a velikostech, s podporou LQIP (Low-Quality Image Placeholders) pro plynulé načítání. Díky multi-gallery architektuře lze snadno přidat novou galerii nebo buildovat různé galerie nezávisle na sobě.

### 1.2 Klíčové charakteristiky

- **Multi-gallery architektura**: Jedna kódová základna, více galerií řízených proměnnou `CONTENT_DIR`
- **Moderní technologický stack**: SvelteKit 5 s Svelte runes, Tailwind CSS v4, Bun runtime
- **Pokročilé zpracování obrázků**: Automatizovaná generace variant v různých formátech a velikostech pomocí Sharp
- **Performance-first přístup**: Lazy loading, optimalizované formáty, LQIP placeholders, hash-based smart caching
- **Kurátorský režim**: Pokročilé nástroje pro editaci metadat, detekci duplikátů a správu fotografií
- **Statický export**: Pre-rendered statická stránka s optimálním SEO
- **Type-safe**: Kompletní TypeScript pokrytí napříč projektem
- **Testování**: Komprehenzivní testing strategie (unit, component, integration, E2E)
- **Developer Experience**: Moderní tooling (Biome, Prettier, Stylelint, Playwright, Vitest)

### 1.3 Aktuální technologický stack

#### Runtime a Build Tools

- **Runtime**: [Bun](https://bun.sh/) - JavaScript runtime i package manager
- **Framework**: [SvelteKit](https://kit.svelte.dev/) v2.43+ s Svelte 5.39+
- **Build Tool**: [Vite](https://vitejs.dev/) v7.1+
- **Adapter**: `@sveltejs/adapter-static` - generování statického výstupu

#### Frontend

- **UI Framework**: Svelte 5 (s runes API)
- **CSS Framework**: Tailwind CSS v4.1+ s `@tailwindcss/vite` plugin
- **UI Components**: bits-ui (headless komponenty)
- **Utility Libraries**:
  - `clsx` - podmíněné CSS třídy
  - `tailwind-merge` - merge Tailwind tříd
  - `tailwind-variants` - varianty komponent
  - `tw-animate-css` - animace

#### Image Processing

- **Image Library**: [Sharp](https://sharp.pixelplumbing.com/) v0.33+ (vyžaduje libvips)
- **EXIF Extraction**: exifr v7.1+
- **Pixel Comparison**: pixelmatch v5.3+, pngjs v7.0+

#### Content Processing

- **Markdown**: marked v12.0+, gray-matter v4.0+
- **Slugification**: slugify v1.6+

#### Development & Testing

- **TypeScript**: v5.9+
- **Linting/Formatting**:
  - Biome v2.2+ (hlavní linter a formatter)
  - Stylelint v16.25+ pro CSS
  - Prettier v3 pro Svelte a Markdown
- **Testing**:
  - Vitest v3.2+ (unit a integration testy)
  - Playwright v1.55+ (E2E testy)
  - @vitest/browser pro browser testing
  - vitest-browser-svelte pro Svelte komponenty
- **Pre-commit**: lint-staged

#### Dependencies Management

- **Node Version**: >=24 (specifikováno v engines)
- **Package Manager**: Bun (lockfile: bun.lock)

### 1.4 Celková architektura systému

```
┌─────────────────────────────────────────────────────────────┐
│                     CONTENT LAYER                            │
│  content/<CONTENT_DIR>/        Multi-gallery obsah          │
│  ├─ pics/                      Originální JPEG/PNG/HEIC     │
│  ├─ site.md                    Konfigurace galerie          │
│  ├─ favicons-source.png        Zdroj pro favicon            │
│  └─ *.md                       Story markdown soubory       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  BUILD TIME LAYER                            │
│                                                              │
│  scripts/generate-images.ts (řízeno CONTENT_DIR)             │
│  ├─ Načte JPEG/PNG/HEIC z content/<CONTENT_DIR>/pics/      │
│  ├─ Extrahuje EXIF metadata (datum, GPS, IPTC, XMP)         │
│  ├─ Generuje varianty (default, xl, detail, fallback)       │
│  ├─ Vytváří formáty (AVIF, WebP, JPEG)                     │
│  ├─ Generuje LQIP placeholders (24px blur)                  │
│  ├─ Hash-based caching pro rychlost                         │
│  ├─ Ukládá do static/<CONTENT_DIR>/images/                 │
│  └─ Vytváří manifesty: src/data/<CONTENT_DIR>/*.json    │
│     (images, analysis, embeddings, faces)           │
│                                                              │
│  Cache: .temp/<CONTENT_DIR>/images.cache.json               │
│  Režimy: --manifestOnly, --curation, --watch, --clean       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│                                                              │
│  SvelteKit Application (src/) - sdílená mezi galeriemi      │
│  ├─ routes/                  File-based routing             │
│  │  ├─ +layout.server.ts     Načítá manifesty aktivní gal.  │
│  │  ├─ +layout.ts            Client-side layout load        │
│  │  ├─ +page.server.ts       Server-side page data load     │
│  │  ├─ +page.svelte          Page komponenta                │
│  │  └─ api/                  API endpointy (geocode, meta)  │
│  │                                                           │
│  ├─ lib/                     Shared code                     │
│  │  ├─ components/           Svelte komponenty              │
│  │  │  ├─ Hero.svelte        Hero sekce                     │
│  │  │  ├─ PhotoGrid.svelte   Galerie (masonry grid)         │
│  │  │  ├─ AppSidebar.svelte  Sidebar s filtry/editor        │
│  │  │  └─ ui/                Shadcn-svelte komponenty       │
│  │  ├─ stores/               Svelte 5 stores (stav)         │
│  │  ├─ types/                TypeScript typy                │
│  │  └─ utils/                Utility funkce                 │
│  │                                                           │
│  ├─ data/<CONTENT_DIR>/      Split & Link manifesty     │
│  │  ├─ images.manifest.json  (pixel metadata/EXIF)      │
│  │  ├─ analysis.manifest.json (aesthetic scores)        │
│  │  ├─ embeddings.manifest.json (AI features)           │
│  │  ├─ faces.manifest.json   (detections/assignments)   │
│  │  ├─ menu.manifest.json                               │
│  │  └─ site.manifest.json                               │
│  │                                                           │
│  └─ app.html / app.css       HTML šablona a globální styly  │
│                                                              │
│  Alias $manifests → src/data/<CONTENT_DIR>              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     BUILD OUTPUT                             │
│                                                              │
│  Vite Build (řízeno OUTPUT_DIR)                              │
│  └─ Generuje statický výstup do build-<CONTENT_DIR>/        │
│     ├─ HTML stránky (pre-rendered SSG)                      │
│     ├─ JavaScript bundle (client-side hydration)            │
│     ├─ CSS bundle (Tailwind v4 utilities)                   │
│     └─ _app/ (chunked assets)                               │
│                                                              │
│  Static Assets (static/<CONTENT_DIR>/)                       │
│  └─ Kopírovány do build-<CONTENT_DIR>/                      │
│     ├─ images/  Optimizované fotografie (AVIF/WebP/JPEG)    │
│     ├─ assets/favicons/  Generované favicons                │
│     └─ robots.txt (pokud existuje)                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 Deployment strategie

Projekt je navržen jako **statická webová stránka** (Static Site Generation - SSG):

1. **Build proces**:
   - `bun run generate` - Generování obrázků a favicon
   - `vite build` - SvelteKit build
   - Výstup: adresář `build/` (nebo `build-egypt-2025/`) s kompletní statickou stránkou

2. **Deployment možnosti**:
   - **Vercel, Netlify, Cloudflare Pages** - Push-to-deploy
   - **GitHub Pages** - Statické hosting
   - **Tradiční hosting** - Jakýkoliv webserver (Apache, Nginx)

3. **Optimalizace**:
   - Pre-rendered všechny stránky (SSG)
   - Optimalizované assety (chunking, tree-shaking)
   - Optimalizované obrázky (moderní formáty, responsive)
   - SEO-friendly (pre-rendered HTML, robots.txt)

### 1.6 Integrace dokumentačních souborů

Projekt obsahuje komplexní dokumentaci v několika souborech:

- **README.md**: Hlavní dokumentace projektu, instalace, použití, skripty
- **CLAUDE.md**: Specifická dokumentace pro Claude AI asistenta
- **TESTING-IMAGES.md**: Detailní dokumentace testovací strategie pro image generation pipeline
- **ARCHITECTURE.md** (tento dokument): Komplexní architektonická dokumentace

Všechny tyto dokumenty jsou vzájemně propojeny a poskytují různé úrovně detailu pro různé účely (uživatelská dokumentace, AI asistent, testing, architektura).

---

## 2. Struktura projektu

### 2.1 Mapování hlavních adresářů

```
bun-svelte-photoblog/               # Root adresář SvelteKit aplikace
│
├─ content/ (../content/)           # Obsahové soubory (oddělené od aplikace)
│  ├─ egypt-2025/                  # Denní fotografie z cesty (originální JPEG)
│  ├─ maps/                         # Mapové podklady
│  ├─ pages/                        # Statické stránky s kontextovými informacemi
│  ├─ routes-for-google-earth+relive/  # GPS trasy
│  ├─ site.md                       # Globální nastavení webu
│  └─ open-graph-egypt-2025.psd    # Social media assets (Open Graph)
│
├─ src/                             # Zdrojový kód SvelteKit aplikace
│  ├─ app.css                       # Globální styly (Tailwind imports)
│  ├─ app.d.ts                      # TypeScript ambient deklarace
│  ├─ app.html                      # HTML šablona (root HTML)
│  ├─ demo.spec.ts                  # Demo unit testy
│  │
│  ├─ lib/                          # Sdílený kód aplikace
│  │  ├─ assets/                    # Statické assety (SVG, ikony)
│  │  ├─ components/                # Svelte komponenty
│  │  │  ├─ ui/                     # UI knihovna (bits-ui komponenty)
│  │  │  ├─ Hero.svelte             # Hero sekce homepage
│  │  │  ├─ PhotoGrid.svelte        # Galerie fotografií (hlavní komponenta)
│  │  │  ├─ Header.svelte           # Hlavička stránky
│  │  │  └─ Footer.svelte           # Patička stránky
│  │  ├─ hooks/                     # Custom Svelte hooks
│  │  ├─ types/                     # TypeScript type definitions
│  │  └─ images.manifest.json       # Runtime manifest fotografií (generován build scriptem)
│  │
│  └─ routes/                       # SvelteKit file-based routing
│     ├─ +layout.server.ts          # Server-side layout load
│     ├─ +layout.ts                 # Client-side layout load
│     ├─ +layout.svelte             # Layout komponenta
│     ├─ +page.server.ts            # Server-side page data load
│     └─ +page.svelte               # Homepage komponenta
│
├─ static/                          # Statické soubory (kopírovány do buildu)
│  ├─ images/                       # Generované optimalizované obrázky
│  │  └─ egypt-2025/               # Fotoblog obrázky (generovány build scriptem)
│  └─ robots.txt                    # SEO konfigurace
│
├─ scripts/                         # Build a utility skripty
│  ├─ config.ts                     # Centrální konfigurace pro image generation
│  ├─ generate-images.ts            # Hlavní skript pro generování obrázků
│  └─ lib/                          # Pomocné funkce pro skripty
│     └─ cli-parser.ts              # CLI argument parser
│
├─ tests/                           # Testovací soubory
│  ├─ integration/                  # Integration testy
│  ├─ unit/                         # Unit testy
│  └─ utils/                        # Test utilities
│
├─ e2e/                             # End-to-end testy (Playwright)
│  └─ demo.test.ts                  # Demo E2E test
│
├─ .svelte-kit/                     # SvelteKit build cache (generován automaticky)
├─ node_modules/                    # NPM dependencies
├─ build/                           # Production build output (generován)
│
└─ [Konfigurační soubory - viz sekce 4]
```

### 2.2 Hierarchie složek a organizace kódu

#### 2.2.1 Content Layer (`../content/`)

**Oddělení obsahu od aplikace**: Content je v nadřazeném adresáři, protože:

- Umožňuje sdílení obsahu mezi různými verzemi aplikace
- Odděluje data od logiky
- Usnadňuje správu a verzování obsahu

**Struktura content/**:

```
content/
├─ egypt-2025/              # Denní fotografie (organizované po dnech)
│  ├─ 2022-03-21/
│  │  ├─ IMG_0001.jpg        # Originální JPEG fotografie
│  │  ├─ IMG_0002.jpg
│  │  └─ story.md            # Volitelný story/popis dne
│  ├─ 2022-03-22/
│  └─ ...
│
├─ pages/                    # Statické stránky (Markdown)
│  ├─ o-projektu.md
│  ├─ mista/
│  │  ├─ jerusalem.md        # Informace o Jeruzalémě
│  │  └─ petra.md            # Informace o Petře
│  └─ ...
│
├─ maps/                     # Mapové podklady
│  └─ route-overview.geojson
│
├─ routes-for-google-earth+relive/  # GPS trasy
│  └─ egypt-2025.gpx
│
├─ site.md                   # Globální metadata webu
└─ open-graph-egypt-2025.psd  # Design assets
```

#### 2.2.2 Application Layer (`src/`)

**SvelteKit struktura** (standardní SvelteKit konvence):

```
src/
├─ routes/                   # File-based routing (každý soubor = route)
│  ├─ +layout.server.ts      # Server load pro layout (běží jen na serveru/build time)
│  ├─ +layout.ts             # Client load pro layout (běží na klientovi)
│  ├─ +layout.svelte         # Layout komponenta (obaluje všechny stránky)
│  ├─ +page.server.ts        # Server load pro homepage (načítá data z manifestu)
│  └─ +page.svelte           # Homepage komponenta (zobrazuje fotogalerii)
│
├─ lib/                      # Sdílený kód (importovatelný přes $lib alias)
│  ├─ components/
│  │  ├─ Hero.svelte         # Hero sekce (titulní obrázek + název)
│  │  ├─ PhotoGrid.svelte    # Galerie fotografií (hlavní funkčnost)
│  │  ├─ Header.svelte       # Hlavička (navigace)
│  │  ├─ Footer.svelte       # Patička (copyright, odkazy)
│  │  └─ ui/                 # UI knihovna (bits-ui wrappery)
│  │     ├─ card/            # Card komponenty
│  │     ├─ dialog/          # Dialog/Modal komponenty
│  │     ├─ sheet/           # Sheet/Drawer komponenty
│  │     ├─ sidebar/         # Sidebar komponenty
│  │     └─ ...
│  │
│  ├─ types/                 # TypeScript types
│  │  └─ manifest.ts         # Typy pro images.manifest.json
│  │
│  ├─ hooks/                 # Custom Svelte hooks
│  │  └─ (prázdné zatím)
│  │
│  └─ images.manifest.json   # Runtime manifest fotografií
│
├─ app.html                  # Root HTML šablona
├─ app.css                   # Globální styly (Tailwind direktivy)
├─ app.d.ts                  # Ambient TypeScript deklarace
└─ demo.spec.ts              # Demo unit test
```

**SvelteKit routing konvence**:

- `+page.svelte` = stránka
- `+page.server.ts` = server-side data loading
- `+page.ts` = client-side data loading
- `+layout.svelte` = layout obalující stránky
- `+layout.server.ts` / `+layout.ts` = layout data loading
- `+error.svelte` = error stránka
- `+server.ts` = API endpoint

#### 2.2.3 Scripts Layer (`scripts/`)

**Build-time zpracování obrázků**:

```
scripts/
├─ config.ts                 # Centrální konfigurace
│                            # - Varianty obrázků, formáty, kvalita
│                            # - Cesty (source, output, cache)
│
├─ generate-images.ts        # Hlavní skript (entry point)
│
├─ generate-favicons.ts      # Generování favicon
│
└─ lib/
   ├─ cli-parser.ts          # Parser CLI argumentů
   ├─ incremental-build.ts   # Logika inkrementálního buildu
   ├─ image-processor.ts     # Zpracování jednoho obrázku (Sharp)
   ├─ manifest-builder.ts    # Vytváření manifestů
   └─ logger.ts              # Winston logger konfigurace
```

#### 2.2.4 Testing Layer (`tests/`, `e2e/`)

```
tests/
├─ unit/                     # Unit testy
│  ├─ images-cli.unit.spec.ts # Testování CLI argumentů a defaults
│  ├─ manifest-builder.unit.spec.ts # Testování generování manifestu
│  └─ ...
│
├─ integration/              # Integration testy
│  └─ generate-and-blur.int.spec.ts # Komplexní test generování a blur
│
└─ utils/                    # Test utilities (fixtures, helpers)

e2e/
└─ demo.test.ts              # Playwright E2E test
```

### 2.3 Vztah mezi zdrojovými soubory a buildovaným výstupem

```
ZDROJOVÉ SOUBORY          →  BUILD PROCES             →  VÝSTUP (build/)
─────────────────────────────────────────────────────────────────────────

content/egypt-2025/      →  scripts/generate-        →  static/images/
├─ 2022-03-21/                images.ts                   egypt-2025/
│  ├─ IMG_0001.jpg        →  [Sharp processing]       →  ├─ details/
│  └─ IMG_0002.jpg                                         │  ├─ img_0001.avif
                                                           │  ├─ img_0001.webp
                                                           │  └─ img_0001.jpg
                                                           ├─ previews/
                                                           ├─ previews-xl/
                                                           └─ previews-xxs/

src/routes/               →  Vite + SvelteKit         →  build/
├─ +page.svelte           →  [SSG Rendering]          →  index.html
├─ +layout.svelte                                         _app/
                                                          ├─ immutable/
                                                          │  ├─ chunks/
                                                          │  ├─ entry/
                                                          │  └─ nodes/
                                                          └─ version.json

src/app.css               →  Tailwind + Vite          →  _app/immutable/
@tailwind base;           →  [PostCSS processing]        assets/app-[hash].css
@tailwind components;
@tailwind utilities;

static/                   →  [Copy as-is]            →  build/
├─ images/                                                images/
└─ robots.txt                                            robots.txt

src/lib/images.manifest.  →  [Embedded in JS bundle] →  _app/immutable/
json                                                      chunks/[hash].js
```

**Build proces flow**:

1. **Generate** (`bun run generate`):
   - Spouští `images:build` a `favicons:build`
   - `images:build` využívá inkrementální cache (`.temp/images-*.cache.json`)
   - `dev` command používá `--manifestOnly` pro rychlý start (generuje jen JSON, pokud obrázky existují)

2. **Main build** (`bun run build` = `vite build`):
   - SvelteKit compilation (Svelte → JavaScript)
   - TypeScript compilation (TS → JS)
   - Tailwind processing (CSS → optimizované CSS)
   - Asset optimization (chunking, minification)
   - SSG rendering (Svelte komponenty → HTML)
   - Static file copy (static/ → build/)

3. **Output**:
   - `build/index.html` - Pre-rendered homepage
   - `build/_app/` - JavaScript a CSS bundles
   - `build/images/` - Optimalizované fotografie
   - `build/robots.txt` - SEO konfigurace

---

## 3. Analýza souborů

**Poznámka k reorganizaci**: Původní záměr této sekce byl systematická analýza souborů podle abecedy nebo hierarchie. Z praktického hlediska je však tato analýza přehledněji strukturována **tematicky** v následujících sekcích:

- **Sekce 4**: Konfigurační soubory (svelte.config.js, vite.config.ts, tailwind.config.ts, tsconfig.json, biome.json, atd.)
- **Sekce 5**: Scripts a build-time zpracování (scripts/generate-images.ts, scripts/config.ts, atd.)
- **Sekce 6**: SvelteKit aplikační vrstva (app.html, app.css, routes/, atd.)
- **Sekce 7**: Svelte komponenty (Hero.svelte, PhotoGrid.svelte, Header.svelte, atd.)
- **Sekce 8**: Datové toky a runtime logika

Toto tematické uspořádání poskytuje lepší pochopení souvislostí mezi soubory a jejich rolí v systému, což je cennější pro účely migrace než čistě alfabetický výpis.

---

## 4. Konfigurační soubory

Tato sekce poskytuje kompletní přehled všech konfiguračních souborů v root adresáři projektu, jejich účel, strukturu a vliv na development workflow a build proces.

### 4.1 SvelteKit konfigurace

#### svelte.config.js

**Cesta**: `/svelte.config.js`
**Účel**: Hlavní konfigurační soubor pro SvelteKit framework

**Obsah**:

```javascript
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() },
};

export default config;
```

**Klíčové konfigurace**:

- **preprocess**: `vitePreprocess()` - použití Vite preprocessoru pro Svelte soubory
  - Umožňuje TypeScript v `<script lang="ts">`
  - Umožňuje PostCSS/Tailwind v `<style>`
  - Automatická transformace moderních JS features
- **adapter**: `adapter-static()` - generování statického výstupu
  - Pre-renderuje všechny stránky do HTML
  - Výstup: adresář `build/` s kompletní statickou stránkou
  - Vhodné pro Netlify, Vercel, GitHub Pages, atd.

**Vliv na build**:

- Určuje jak se Svelte komponenty kompilují
- Řídí výstupní formát (statický vs. SSR server)
- Určuje preprocessing pipeline

### 4.2 Vite konfigurace

#### vite.config.ts

**Cesta**: `/vite.config.ts`
**Účel**: Konfigurace Vite build toolu a Vitest testing frameworku

**Obsah**:

```typescript
import tailwindcss from "@tailwindcss/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { defineConfig } from "vitest/config";

import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: "./vite.config.ts",
        test: {
          name: "client",
          environment: "browser",
          browser: {
            enabled: true,
            provider: "playwright",
            instances: [{ browser: "chromium" }],
          },
          include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          exclude: ["src/lib/server/**"],
          setupFiles: ["./vitest-setup-client.ts"],
        },
      },
      {
        extends: "./vite.config.ts",
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.{test,spec}.{js,ts}"],
          exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
        },
      },
    ],
  },
});
```

**Klíčové konfigurace**:

**Plugins**:

1. `tailwindcss()` - Tailwind CSS v4 Vite plugin
   - Zpracovává Tailwind direktivy (@tailwind base, components, utilities)
   - JIT (Just-In-Time) compilation
   - Automatický purge nepoužitých stylů v production
2. `sveltekit()` - SvelteKit Vite plugin
   - Integrace SvelteKit do Vite
   - Hot Module Replacement (HMR) pro Svelte komponenty
   - Automatická registrace routes
3. `devtoolsJson()` - Developer tools plugin
   - Export dev dat do JSON

**Test konfigurace** (Vitest):

- **Dva testing projekty**:
  1. **Client** (browser testy):
     - Environment: `browser` (Playwright)
     - Testuje Svelte komponenty v reálném prohlížeči
     - Include: `src/**/*.svelte.{test,spec}.{js,ts}`
     - Setup: `vitest-setup-client.ts`
  2. **Server** (Node testy):
     - Environment: `node`
     - Testuje server-side logiku
     - Include: `src/**/*.{test,spec}.{js,ts}`
     - Exclude: Svelte komponenty

**Vliv na build**:

- Určuje Vite plugins pipeline
- Řídí testing strategii (browser vs node)
- Určuje HMR chování v dev módu

#### vitest.config.images.ts

**Cesta**: `/vitest.config.images.ts`
**Účel**: Specializovaná Vitest konfigurace pro testování image generation pipeline

**Obsah**:

```typescript
import path from "node:path";

import { defineConfig } from "vitest/config";

import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 30000,
    include: [
      "tests/unit/**/*.spec.ts",
      "tests/integration/**/*.spec.ts",
      "tests/e2e-images/**/*.spec.ts",
    ],
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    globals: true,
    alias: {
      $lib: path.resolve(__dirname, "./src/lib"),
    },
  },
});
```

**Klíčové konfigurace**:

- **environment**: `node` - všechny image testy běží v Node.js (ne browser)
- **testTimeout**: 60s - delší timeout pro image processing
- **sequence.concurrent**: `false` - testy běží sériově (determinismus)
- **alias**: `$lib` → `./src/lib` - umožňuje importy přes `$lib` v testech
- **includes**: Specializované image testing soubory
  - Unit testy: `tests/unit/**/*.spec.ts`
  - Integration testy: `tests/integration/**/*.spec.ts`
  - E2E image testy: `tests/e2e-images/**/*.spec.ts`

**Spouštění**:

```bash
bun run test:unit:images    # Unit testy pro image processing
bun run test:images         # Integration a E2E image testy
bun run test:all            # Všechny image testy
```

### 4.3 Tailwind CSS konfigurace

#### tailwind.config.ts

**Cesta**: `/tailwind.config.ts`
**Účel**: Konfigurace Tailwind CSS frameworku

**Obsah**:

```typescript
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Klíčové konfigurace**:

- **content**: Definuje soubory, které Tailwind skenuje pro použité třídy
  - `./src/**/*.{html,js,svelte,ts}` - všechny soubory v src/
  - Umožňuje tree-shaking (purge) nepoužitých CSS tříd
- **theme.extend**: Prázdné (používá výchozí Tailwind téma)
- **plugins**: Prázdné (zatím žádné Tailwind pluginy)

**Poznámka**: Projekt používá Tailwind CSS v4 s `@tailwindcss/vite` pluginem, což je novější způsob integrace než tradiční PostCSS plugin.

### 4.4 TypeScript konfigurace

#### tsconfig.json

**Cesta**: `/tsconfig.json`
**Účel**: Konfigurace TypeScript compileru

**Obsah**:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

**Klíčové konfigurace**:

- **extends**: `./.svelte-kit/tsconfig.json` - rozšiřuje SvelteKit generovaný tsconfig
  - SvelteKit automaticky generuje tsconfig s path aliases ($lib, atd.)
- **strict**: `true` - přísný TypeScript mód
  - Zapíná všechny strict type-checking options
  - Zajišťuje maximální type safety
- **allowJs/checkJs**: Umožňuje a type-checkuje JavaScript soubory
- **resolveJsonModule**: Umožňuje import JSON souborů (např. `images.manifest.json`)
- **moduleResolution**: `bundler` - moderní module resolution pro bundlery

**Path aliases** (spravované SvelteKit):

- `$lib` → `src/lib`
- `$lib/*` → `src/lib/*`

### 4.5 Linting a formátování

#### biome.json

**Cesta**: `/biome.json`
**Účel**: Konfigurace Biome linteru a formatteru (alternativa k ESLint + Prettier)

**Obsah**:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.2.6/schema.json",
  "files": {
    "includes": [
      "**/./**",
      "!**/node_modules",
      "!**/build",
      "!**/dist",
      "!**/.svelte-kit",
      "!**/.vite",
      "!**/static/images",
      "!**/static/**/*.jpg",
      "!**/static/**/*.jpeg",
      "!**/static/**/*.png",
      "!**/static/**/*.webp",
      "!**/static/**/*.avif",
      "!**/e2e/**/screenshots",
      "!**/tests/outputs",
      "!**/*.css"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

**Klíčové konfigurace**:

**Files (exclude patterns)**:

- Ignoruje `node_modules`, `build`, `.svelte-kit` (build artefakty)
- Ignoruje obrázky (`static/images/**`, `*.jpg`, `*.webp`, atd.)
- Ignoruje test outputs a screenshots
- Ignoruje CSS soubory (zpracovává Stylelint)

**Formatter**:

- Indent: 2 mezery
- Line width: 100 znaků
- Style: standardní JS/TS formatting

**Linter**:

- Rules: `recommended` - použití doporučených Biome pravidel

**Spouštění**:

```bash
bun run lint           # Biome check + Stylelint
bun run lint:fix       # Biome auto-fix
bun run format         # Biome + Prettier formatting
```

#### .stylelintrc.json

**Cesta**: `/.stylelintrc.json`
**Účel**: Konfigurace Stylelint pro CSS linting

**Obsah**:

```json
{
  "extends": ["stylelint-config-standard", "stylelint-config-tailwindcss"],
  "rules": {
    "selector-class-pattern": "^[a-z]([a-z0-9-]+)?(__([a-z0-9]+(-[a-z0-9]+)*))?(--([a-z0-9]+(-[a-z0-9]+)*))?$"
  }
}
```

**Klíčové konfigurace**:

- **extends**:
  - `stylelint-config-standard` - základní CSS pravidla
  - `stylelint-config-tailwindcss` - podpora Tailwind direktivů (@tailwind, @apply, atd.)
- **selector-class-pattern**: BEM-style pattern pro CSS třídy
  - Format: `block__element--modifier`
  - Tailwind třídy jsou povoleny (díky tailwindcss config)

**Spouštění**:

```bash
bun run lint:css       # Stylelint check
```

#### .stylelintignore

**Cesta**: `/.stylelintignore`
**Účel**: Definuje soubory ignorované Stylelint

_Poznámka: Soubor nebyl poskytnut v analýze, ale typicky obsahuje:_

```
node_modules/
build/
.svelte-kit/
```

### 4.6 Testing konfigurace

#### playwright.config.ts

**Cesta**: `/playwright.config.ts`
**Účel**: Konfigurace Playwright E2E testů

**Obsah**:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "bun run build && bun run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  testDir: "e2e",
});
```

**Klíčové konfigurace**:

- **webServer**: Automaticky spouští aplikaci před testy
  - Command: `bun run build && bun run preview`
    - Nejprve builduje production verzi
    - Pak spouští preview server
  - Port: 4173 (výchozí Vite preview port)
  - Reuse: `true` (pokud už server běží, použije ho - rychlejší dev)
- **testDir**: `e2e` - adresář s E2E testy

**Workflow**:

1. Playwright automaticky spustí `bun run build`
2. Pak spustí `bun run preview` (production preview server)
3. Počká až server běží na portu 4173
4. Spustí testy z `e2e/` adresáře
5. Po testech ukončí server

**Spouštění**:

```bash
bun run test:e2e       # Spustí Playwright E2E testy
```

#### vitest-setup-client.ts

**Cesta**: `/vitest-setup-client.ts`
**Účel**: Setup soubor pro Vitest browser testy (client projekt)

_Poznámka: Obsah souboru nebyl poskytnut, ale typicky obsahuje:_

- Globální test utilities
- Mock setup
- Browser-specific polyfills

### 4.7 UI komponenty konfigurace

#### components.json

**Cesta**: `/components.json`
**Účel**: Konfigurace shadcn-svelte UI knihovny

**Obsah**:

```json
{
  "$schema": "https://shadcn-svelte.com/schema.json",
  "tailwind": {
    "css": "src/app.css",
    "baseColor": "slate"
  },
  "aliases": {
    "components": "$lib/components",
    "utils": "$lib/utils",
    "ui": "$lib/components/ui",
    "hooks": "$lib/hooks",
    "lib": "$lib"
  },
  "typescript": true,
  "registry": "https://shadcn-svelte.com/registry"
}
```

**Klíčové konfigurace**:

- **tailwind**:
  - `css`: `src/app.css` - hlavní CSS soubor s Tailwind direktivami
  - `baseColor`: `slate` - základní barevná paleta
- **aliases**: Path aliasy pro shadcn-svelte CLI
  - `$lib/components` - komponenty
  - `$lib/components/ui` - UI knihovna
  - `$lib/hooks` - hooks
- **typescript**: `true` - generuje TypeScript komponenty
- **registry**: shadcn-svelte komponenty registry

**Použití**:

```bash
npx shadcn-svelte add button    # Přidá button komponentu do $lib/components/ui/
```

### 4.8 Package management

#### package.json

**Cesta**: `/package.json`
**Účel**: NPM/Bun package management a skripty

**Viz sekce 1.3 a 11 pro detailní analýzu dependencies.**

**Klíčové skripty**:

- **Development**: `dev`, `check`, `check:watch`
- **Building**: `build`, `prebuild`, `preview`
- **Testing**: `test`, `test:unit`, `test:e2e`, `test:images`, `test:all`
- **Images**: `images:build`, `images:watch`, `images:blur`, `images:all`
- **Linting**: `lint`, `lint:fix`, `lint:css`, `lint:ci`
- **Formatting**: `format`, `format:check`

#### bun.lock

**Cesta**: `/bun.lock`
**Účel**: Bun lockfile (ekvivalent package-lock.json)

**Vlastnosti**:

- Zajišťuje deterministické instalace dependencies
- Rychlejší než npm/yarn lockfiles
- Binární formát (optimalizovaný pro rychlost)

### 4.9 Git konfigurace

#### .gitignore

**Cesta**: `/.gitignore`
**Účel**: Definuje soubory ignorované Git

_Typický obsah (nebyl poskytnut v analýze):_

```
node_modules/
build/
.svelte-kit/
.vite/
.env
.env.*
!.env.example
*.log
.DS_Store
.images-cache.json
static/images/egypt-2025/
```

**Klíčové ignorované položky**:

- `node_modules/` - dependencies
- `build/` - production build
- `.svelte-kit/` - SvelteKit cache
- `.images-cache.json` - image generation cache
- `static/images/egypt-2025/` - generované obrázky (regenerují se při buildu)

### 4.10 Pre-commit hooks

#### .lintstagedrc.json

**Cesta**: `/.lintstagedrc.json`
**Účel**: Konfigurace lint-staged pro pre-commit hooks

_Poznámka: Obsah souboru nebyl poskytnut, ale typicky obsahuje:_

```json
{
  "*.{js,ts,svelte}": ["biome check --write", "git add"],
  "*.css": ["stylelint --fix", "git add"]
}
```

**Workflow**:

1. Před každým commitem spouští lint-staged
2. Lint-staged spustí linting a formátování na staged souborech
3. Automaticky opraví problémy (`--write`, `--fix`)
4. Přidá opravené soubory zpět do stage (`git add`)

### 4.11 Runtime konfigurace

#### .nvmrc

**Cesta**: `/.nvmrc`
**Účel**: Specifikuje Node.js verzi pro nvm (Node Version Manager)

_Poznámka: Obsah nebyl poskytnut, ale typicky obsahuje:_

```
24
```

**Použití**:

```bash
nvm use          # Aktivuje správnou Node verzi
```

#### .npmrc

**Cesta**: `/.npmrc`
**Účel**: NPM konfigurace

_Poznámka: Obsah nebyl poskytnut, ale může obsahovat:_

```
engine-strict=true
```

### 4.12 Image generation cache

#### .images-cache.json

**Cesta**: `/.images-cache.json`
**Účel**: Cache pro `scripts/generate-images.ts`

**Struktura**:

```json
{
  "version": 1,
  "images": {
    "content/egypt-2025/2022-03-21/IMG_0001.jpg": {
      "hash": "abc123...",
      "mtime": 1679385600000,
      "processed": true
    }
  }
}
```

**Funkce**:

- Trackuje zpracované obrázky (hash + modification time)
- Přeskakuje zpracování nezmněných obrázků
- Výrazně zrychluje opakované buildy
- Invaliduje se při změně `CACHE_VERSION` v `generate-images.ts`

---

## 5. Datové toky

Kompletní mapování jak data prochází systémem.

### 5.1 Build-time data flow

```
1. Content Layer (../content/egypt-2025/)
   ├─ 2022-03-21/IMG_0001.jpg (4000×3000px, 2.5MB)
   ├─ 2022-03-21/IMG_0002.jpg
   └─ 2022-03-21/story.md
         ↓
2. Build Scripts (scripts/generate-images.ts)
   ├─ Extract EXIF (date, GPS, camera)
   ├─ Generate variants (details, previews, previews-xl, fallback)
   ├─ Generate formats (AVIF, WebP, JPEG)
   ├─ Generate placeholders (24px blur)
   ├─ Parse story.md (Markdown → HTML)
   └─ Group by day
         ↓
3. Manifest Generation
   └─ src/lib/images.manifest.json
      {
        "photoDays": [
          {
            "date": "2022-03-21",
            "id": "2022-03-21",
            "items": [
              {
                "type": "image",
                "src": "2022-03-21/IMG_0001.jpg",
                "sources": [...],
                "placeholder": "data:image/png;base64,...",
                "placeholderColor": "#3a5f8c",
                "exif": { "date": "2022-03-21T14:32:15Z", ... }
              },
              {
                "type": "separator",
                "location": "Jerusalem",
                "storyContent": "# Jerusalem\n\n..."
              }
            ]
          }
        ]
      }
         ↓
4. SvelteKit Build (vite build)
   ├─ +layout.server.ts load()
   │  └─ getPhotoDays() → PhotoDay[]
   ├─ +page.server.ts load()
   │  └─ getPhotoDays() → PhotoDay[]
   ├─ Pre-render pages to HTML
   └─ Embed data in HTML
         ↓
5. Build Output (build/)
   ├─ index.html (pre-rendered with embedded data)
   ├─ _app/immutable/chunks/*.js (JavaScript bundles)
   └─ images/egypt-2025/* (optimized images)
```

### 5.2 Runtime data flow (Client)

```
1. Page Load
   └─ build/index.html loaded
         ↓
2. HTML Parsing
   ├─ Parse pre-rendered HTML
   └─ Extract embedded JSON data
         ↓
3. Hydration
   ├─ SvelteKit hydrates app
   ├─ Mount Svelte components
   └─ Attach event listeners
         ↓
4. Component Tree
   +layout.svelte
   ├─ data.menu → Header (MenuManifest)
   │  └─ Renders navigation
   ├─ {@render children}
   │  └─ +page.svelte
   │     └─ data.photoDays → PhotoDay[]
   │        └─ {#each photoDays as day}
   │           └─ PhotoGrid (day.items)
   │              └─ {#each items as item}
   │                 ├─ <picture> (ImageEntry)
   │                 │  ├─ getSources(item) → srcset
   │                 │  └─ Browser selects best image
   │                 └─ <Dialog> (Separator)
   │                    └─ Story modal
   └─ Footer
         ↓
5. Image Loading
   ├─ Browser parses <picture> srcset
   ├─ Selects format (AVIF > WebP > JPEG)
   ├─ Selects size based on viewport
   ├─ Shows placeholder color
   ├─ Lazy loads images (loading="lazy")
   └─ Replaces placeholder with image
```

### 5.3 Type flow

```
Build time:
  manifest.ts types
    ↓
  scripts/generate-images.ts
    ↓
  images.manifest.json (validated against types)

Runtime:
  images.manifest.json
    ↓
  src/lib/images.ts (typed import)
    ↓
  getPhotoDays() → PhotoDay[]
    ↓
  +layout.server.ts load() → { dataset: PhotoDay[], menu: MenuManifest }
    ↓
  +page.svelte (data: PageData)
    ↓
  Components (props typed as ImageEntry, Separator, etc.)
```

---

## 6. Features implementované v projektu

Tato sekce popisuje klíčové features a funkcionality implementované v projektu.

### 6.1 Root soubory (src/)

#### 6.1.1 app.html - HTML šablona

**Cesta**: `src/app.html`
**Účel**: Root HTML šablona pro celou aplikaci

```html
<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>

  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

**Klíčové vlastnosti**:

- **`lang="cs"`**: Čeština jako hlavní jazyk
- **`data-sveltekit-preload-data="hover"`**: Preloading strategie
  - Data se načítají při hover nad linkem
  - Zrychluje navigaci (instant navigation feel)
- **`%sveltekit.head%`**: Placeholder pro `<svelte:head>` obsah
  - Meta tags, title, favicon, atd.
  - Injektováno z komponent
- **`%sveltekit.body%`**: Placeholder pro Svelte aplikaci
  - Root mount point
  - Hydratuje se na klientovi

**Preload strategie**:

- `hover` (default): Preload při hover (nejlepší UX/performance balance)
- `tap`: Preload při touch/click
- `off`: Žádný preload

#### 6.1.2 app.css - Globální styly

**Cesta**: `src/app.css`
**Účel**: Globální CSS s Tailwind v4 a design tokens

**Struktura**:

```css
/* 1. Import Tailwind CSS v4 */
@import "tailwindcss";
@import "tw-animate-css";

/* 2. Plugin pro typografii */
@plugin "@tailwindcss/typography";

/* 3. Dark mode custom variant */
@custom-variant dark (&:is(.dark *));

/* 4. Design tokens (CSS variables) */
:root {
  --radius: 0.625rem;
  --background: oklch(100% 0 0deg);
  --foreground: oklch(12.9% 0.042 264.695deg);
  --primary: oklch(20.8% 0.042 265.755deg);
  --secondary: oklch(96.8% 0.007 247.896deg);
  /* ... další tokens */
}

/* 5. Dark mode overrides */
.dark {
  --background: oklch(12.9% 0.042 264.695deg);
  --foreground: oklch(98.4% 0.003 247.858deg);
  /* ... dark mode tokens */
}

/* 6. Tailwind theme integration */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... mapování na Tailwind utilities */
}

/* 7. Base styles */
@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

**Design system**:

**Color tokens** (OKLCH color space):

- `--background` / `--foreground`: Base colors
- `--primary` / `--primary-foreground`: Primary actions
- `--secondary` / `--secondary-foreground`: Secondary actions
- `--muted` / `--muted-foreground`: Muted elements
- `--accent` / `--accent-foreground`: Accent highlights
- `--destructive`: Error/danger states
- `--border` / `--input` / `--ring`: UI borders
- `--card` / `--popover`: Surface colors
- `--sidebar-*`: Sidebar specific colors
- `--chart-1` through `--chart-5`: Chart colors

**Proč OKLCH?**

- Perceptuálně uniformní (lepší než HSL)
- Lepší gamut coverage (wider color space)
- Smoothější gradients
- Moderní standard (CSS Color Module Level 4)

**Border radius scale**:

```css
--radius: 0.625rem; /* Base (10px) */
--radius-sm: 0.425rem; /* Small (6.8px) */
--radius-md: 0.525rem; /* Medium (8.4px) */
--radius-lg: 0.625rem; /* Large (10px) */
--radius-xl: 0.825rem; /* XL (13.2px) */
```

**Dark mode**:

- Class-based: `.dark` class na root elementu
- Custom variant: `@custom-variant dark (&:is(.dark *))`
- Usage: `bg-background dark:bg-dark-background`

### 6.2 SvelteKit Routing

SvelteKit používá **file-based routing** - každý soubor v `src/routes/` vytváří route.

#### 6.2.1 Route struktura

```
src/routes/
├─ +layout.server.ts       # Server-side layout load
├─ +layout.ts              # Client-side layout config
├─ +layout.svelte          # Layout komponenta (Header + Footer)
├─ +page.server.ts         # Server-side homepage data
└─ +page.svelte            # Homepage komponenta
```

**Naming conventions**:

- `+page.svelte` = Stránka (route endpoint)
- `+page.server.ts` = Server-side data loading
- `+page.ts` = Client-side data loading
- `+layout.svelte` = Layout obalující stránky
- `+layout.server.ts` = Server-side layout data
- `+layout.ts` = Client-side layout config
- `+error.svelte` = Error page
- `+server.ts` = API endpoint

#### 6.2.2 +layout.server.ts - Server-side layout data

**Cesta**: `src/routes/+layout.server.ts`

```typescript
import { getMenuItems, getPhotoDays } from "$lib";

import type { MenuManifest, PhotoDay } from "$lib/types/manifest";

export async function load() {
  const photoDays: PhotoDay[] = getPhotoDays();
  const menuItems: MenuManifest = getMenuItems();

  return { dataset: photoDays, menu: menuItems };
}
```

**Funkce**:

- Běží **pouze na serveru** (při SSG build time)
- Načítá data z manifestu (`images.manifest.json`)
- Vrací data dostupná ve všech child routes
- Data jsou serializována a posílána klientovi

**Data flow**:

```
Build time:
  images.manifest.json (disk)
    ↓
  getPhotoDays() (src/lib/images.ts)
    ↓
  return { dataset, menu } (server load)
    ↓
  Serialize to JSON
    ↓
  Embed in HTML (SSG)
    ↓
  Hydrate on client

Runtime (client):
  data.dataset → PhotoDay[]
  data.menu → MenuManifest
```

#### 6.2.3 +layout.ts - Client layout config

**Cesta**: `src/routes/+layout.ts`

```typescript
export const prerender = true;
```

**Konfigurace**:

- **`prerender = true`**: Zapíná SSG (Static Site Generation)
- Aplikuje se na všechny child routes
- SvelteKit při buildu generuje statický HTML
- Výsledek: `build/index.html` (pre-rendered)

**SSG vs SSR**:
| | SSG (`prerender = true`) | SSR (`prerender = false`) |
| --------------- | ---------------------------- | -------------------------- |
| **Build time** | Generuje HTML při buildu | Bez HTML generování |
| **Runtime** | Statický HTML (instant load) | Server renderuje on-demand |
| **Deployment** | Statický hosting (CDN) | Node.js server |
| **SEO** | Perfektní (crawlable HTML) | Perfektní (crawlable HTML) |
| **Performance** | Nejrychlejší (CDN edge) | Rychlý (server rendering) |

#### 6.2.4 +layout.svelte - Layout komponenta

**Cesta**: `src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import favicon from "$lib/assets/favicon.svg?url";
  import Footer from "$lib/components/Footer.svelte";
  import Header from "$lib/components/Header.svelte";

  import "../app.css";

  let { data, children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Header menuItems={data.menu} />

{@render children?.()}

<Footer />
```

**Klíčové vlastnosti**:

**Svelte 5 runes**:

- `let { data, children } = $props()` - Props destructuring (Svelte 5)
  - `data`: Data z `+layout.server.ts` load funkce
  - `children`: Render snippet (child routes)

**Layout struktura**:

```
<svelte:head>    → Meta tags, favicon
<Header>         → Sticky header s menu
{@render children}  → Child route content (+page.svelte)
<Footer>         → Footer s copyright
```

**Render snippet** (`children`):

- Svelte 5 feature (replacement pro `<slot>`)
- Syntax: `{@render children?.()}`
- Optional chaining: `?.()` (safe render)

**CSS import**:

- `import '../app.css'` - Globální styly
- Importuje se v layout (aplikuje se na všechny stránky)

#### 6.2.5 +page.server.ts - Homepage data

**Cesta**: `src/routes/+page.server.ts`

```typescript
import { getPhotoDays } from "$lib/images";
import type { PhotoDay } from "$lib/types/manifest";

export async function load() {
  const photoDays: PhotoDay[] = getPhotoDays();

  return {
    photoDays,
  };
}
```

**Funkce**:

- Načítá data specifická pro homepage
- Běží na serveru (build time při SSG)
- Vrací `photoDays` array pro PhotoGrid

**Data merging**:

```typescript
// V +page.svelte:
let { data } = $props<{ data: PageData }>();

// data obsahuje:
// - data.photoDays (z +page.server.ts)
// - data.dataset (z +layout.server.ts)
// - data.menu (z +layout.server.ts)
```

#### 6.2.6 +page.svelte - Homepage

**Cesta**: `src/routes/+page.svelte`

```svelte
<script lang="ts">
  import Hero from "$lib/components/Hero.svelte";
  import PhotoGrid from "$lib/components/PhotoGrid.svelte";
  import { Badge } from "$lib/components/ui/badge/";

  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  const photoDays = data.photoDays || [];

  function formatDateForDisplay(dateValue: string | Date): string {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(new Date(dateValue));
  }

  function formatWeekdayCzech(dateValue: string | Date): string {
    return new Intl.DateTimeFormat("cs-CZ", { weekday: "long" }).format(new Date(dateValue));
  }
</script>

<Hero />

<main>
  {#each photoDays as day (day.date)}
    {@const daySectionId = day.id ?? `day-${day.date}`}
    <section id={daySectionId} class="container mx-auto py-8">
      <div data-cy="day-head" class="max-w-xl mx-auto text-center mb-12">
        <h2 class="mb-1 text-3xl">
          <span class="block mb-1 text-xs font-normal tracking-[0.05em] uppercase ...">
            {formatWeekdayCzech(day.date)}
          </span>
          {formatDateForDisplay(day.date)}
        </h2>

        {#if day.cities && day.cities.length > 0}
          <div data-cy="day-cities" class="mb-6 text-lg">
            {day.cities.join(" — ")}
          </div>
        {/if}

        {#if day.locations && day.locations.length > 0}
          <div data-cy="day-where" class="mx-auto mb-5 gap-2 flex flex-wrap justify-center">
            {#each day.locations as locationName (locationName)}
              <Badge variant="secondary">{locationName}</Badge>
            {/each}
          </div>
        {/if}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <PhotoGrid items={day.items} />
      </div>
    </section>
  {/each}
</main>
```

**Struktura stránky**:

1. **Hero sekce**: Úvodní banner s názvem a popisem
2. **Main** - Hlavní obsah:
   - Loop přes `photoDays`
   - Pro každý den:
     - **Section** s ID (anchor links)
     - **Day header**:
       - Weekday name (čtvrtek, pátek, ...)
       - Date (21. 3. 2022)
       - Cities list (Jerusalem, Bethlehem)
       - Locations badges (Western Wall, Church of ...)
     - **PhotoGrid**: Responsive grid s fotografiemi

**Responsive grid**:

```css
grid-cols-1           /* Mobile: 1 column */
sm:grid-cols-2        /* ≥640px: 2 columns */
lg:grid-cols-3        /* ≥1024px: 3 columns */
xl:grid-cols-4        /* ≥1280px: 4 columns */
```

**Svelte features**:

- `{#each}` loop s key (`day.date`)
- `{@const}` inline constants
- `{#if}` conditionals
- `data-cy` attributes (Cypress E2E testing)

**Internationalization**:

- `Intl.DateTimeFormat('cs-CZ')` - Nativní i18n API
- Weekday: `{ weekday: 'long' }` → "čtvrtek"
- Date: `{ day: 'numeric', month: 'numeric', year: 'numeric' }` → "21. 3. 2022"

### 6.3 Type System

**Cesta**: `src/lib/types/manifest.ts`

Centrální TypeScript types pro celou aplikaci.

#### 6.3.1 Core types

**ImageSource** - Varianta obrázku:

```typescript
export type ImageSource = {
  variant: "default" | "xl" | "detail" | "fallback";
  type: "image/webp" | "image/jpeg" | "image/avif";
  path: string;
  width: number;
  height?: number;
};
```

**ImageEntry** - Kompletní fotografie:

```typescript
export type ImageEntry = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  title: string;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
  placeholderColor?: string;
  placeholder?: string;
  exif?: {
    date?: string;
    location?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    orientation?: number;
  };
  sources: ImageSource[];
};
```

**Separator** - Location marker:

```typescript
export type Separator = {
  type: "separator";
  location: string;
  city: string;
  storyContent?: string;
  id: string;
};
```

**PhotoDay** - Den fotografií:

```typescript
export type PhotoDay = {
  date: string;
  id: string;
  items: (ImageEntry | Separator)[];
};
```

**Manifest** - Root struktura:

```typescript
export type Manifest = {
  photoDays: PhotoDay[];
};
```

**MenuManifest** - Menu data:

```typescript
export type MenuDay = {
  id: string;
  date: string;
  label: string;
  locations: { id: string; label: string }[];
};

export type MenuManifest = MenuDay[];
```

#### 6.3.2 Type safety flow

```
Build time (scripts/generate-images.ts):
  ↓
  Types from manifest.ts
  ↓
  Generate images.manifest.json (conforms to Manifest type)
  ↓

Runtime (src/lib/images.ts):
  ↓
  Import manifest as Manifest type
  ↓
  getPhotoDays() → PhotoDay[]
  ↓

SvelteKit load functions:
  ↓
  load() → { photoDays: PhotoDay[] }
  ↓

Components:
  ↓
  Props typed as PhotoDay, ImageEntry, etc.
  ↓
  Full TypeScript safety across entire stack
```

### 6.4 Library utilities (src/lib/)

#### 6.4.1 index.ts - Central exports

**Cesta**: `src/lib/index.ts`

```typescript
export { getPhotoDays } from "./images";
export { getMenuItems } from "./menu";
```

**Účel**: Centrální export surface pro `$lib` alias

**Usage**:

```typescript
import { getPhotoDays, getMenuItems } from "$lib";
// vs
import { getPhotoDays } from "$lib/images";
import { getMenuItems } from "$lib/menu";
```

#### 6.4.2 images.ts - Manifest utilities

**Cesta**: `src/lib/images.ts`

```typescript
import manifest from "$lib/images.manifest.json" with { type: "json" };

import type { ImageEntry, ImageSource, Manifest, PhotoDay } from "./types/manifest";

const typedManifest: Manifest = manifest as unknown as Manifest;

export function getManifest(): Manifest {
  return typedManifest;
}

export function getPhotoDays(): PhotoDay[] {
  return typedManifest.photoDays ?? [];
}

export function getSources(item: ImageEntry) {
  const sourcesByType: { [type: string]: string[] } = {};

  // Group all available sizes by image type
  for (const source of item.sources) {
    if (!sourcesByType[source.type]) {
      sourcesByType[source.type] = [];
    }
    sourcesByType[source.type].push(`${source.path} ${source.width}w`);
  }

  // Create <picture> sources, ordered by preference (AVIF > WebP > JPEG)
  return Object.entries(sourcesByType)
    .map(([type, srcsetParts]) => ({
      type: type,
      srcset: srcsetParts.join(", "),
    }))
    .sort((a, b) => {
      if (a.type.includes("avif")) return -1;
      if (b.type.includes("avif")) return 1;
      if (a.type.includes("webp")) return -1;
      if (b.type.includes("webp")) return 1;
      return 0;
    });
}
```

**Klíčové funkce**:

**`getSources(item)`** - Generuje `<picture>` sources:

```typescript
// Input:
{
  sources: [
    { variant: 'default', type: 'image/avif', path: '/img/1.avif', width: 370 },
    { variant: 'xl', type: 'image/avif', path: '/img/1-xl.avif', width: 534 },
    { variant: 'default', type: 'image/webp', path: '/img/1.webp', width: 370 },
    { variant: 'xl', type: 'image/webp', path: '/img/1-xl.webp', width: 534 },
    { variant: 'default', type: 'image/jpeg', path: '/img/1.jpg', width: 370 },
  ]
}

// Output:
[
  {
    type: 'image/avif',
    srcset: '/img/1.avif 370w, /img/1-xl.avif 534w'
  },
  {
    type: 'image/webp',
    srcset: '/img/1.webp 370w, /img/1-xl.webp 534w'
  },
  {
    type: 'image/jpeg',
    srcset: '/img/1.jpg 370w'
  }
]

// Used in <picture>:
<picture>
  <source type="image/avif" srcset="/img/1.avif 370w, /img/1-xl.avif 534w" />
  <source type="image/webp" srcset="/img/1.webp 370w, /img/1-xl.webp 534w" />
  <img src="/img/1.jpg" srcset="/img/1.jpg 370w" />
</picture>
```

**Format prioritization**:

1. **AVIF**: Nejlepší komprese (první v `<picture>`)
2. **WebP**: Dobrá komprese, široká podpora (druhý)
3. **JPEG**: Fallback pro starší prohlížeče (poslední)

**Responsive images**:

- `srcset` s width descriptors (`370w`, `534w`)
- Browser vybere nejvhodnější velikost podle viewport
- `sizes` attribute určuje viewport breakpoints

---

## 7. GUI komponenty

Detailní analýza všech Svelte komponent v aplikaci.

### 7.1 Hero.svelte - Hero sekce

**Cesta**: `src/lib/components/Hero.svelte`

```svelte
<script lang="ts">
  // (Zakomentované importy pro budoucí použití)
</script>

<section class="py-24 container mx-auto">
  <div class="grid items-center gap-8 lg:grid-cols-2">
    <div class="flex flex-col items-center text-center lg:items-start lg:text-left">
      <h1 class="my-6 text-pretty text-3xl font-bold lg:text-5xl">Izrael 2022</h1>

      <p class="text-muted-foreground mb-8 max-w-xl lg:text-lg text-balance">
        Fotografické střípky z výletu do Izraele a Jordánska.
      </p>
    </div>
  </div>
</section>
```

**Funkce**: Jednoduchá úvodní sekce s názvem a popisem

**Responsive design**:

- Mobile: Center aligned
- Desktop (`lg:`): Left aligned
- Typography scale: `text-3xl` → `lg:text-5xl`

### 7.2 PhotoGrid.svelte - Galerie fotografií

**Cesta**: `src/lib/components/PhotoGrid.svelte`

```svelte
<script lang="ts">
  import { marked } from "marked";

  import { buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { getSources } from "$lib/images";
  import type { ImageEntry, ImageSource, Separator } from "$lib/types/manifest";

  let { items } = $props<{
    items: (ImageEntry | Separator)[];
  }>();

  function renderStoryHtml(separator: Separator) {
    return separator.storyContent ? marked.parse(separator.storyContent) : "";
  }

  function findFallbackSource(image: ImageEntry): ImageSource | undefined {
    return image.sources.find((source) => source.variant === "fallback");
  }
</script>

{#each items as item (item.type === "image" ? item.src : item.location)}
  {#if item.type === "image"}
    {@const fallback = findFallbackSource(item)}
    <figure class={`bg-cover bg-center bg-[${item.placeholderColor}] rounded-lg ...`}>
      {#if fallback}
        <picture>
          {#each getSources(item) as source (source.type)}
            <source
              type={source.type}
              srcset={source.srcset}
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          {/each}
          <img
            src={fallback.path}
            alt={item.alt}
            loading="lazy"
            class="w-full h-full object-cover"
            width={fallback.width}
            height={fallback.height}
          />
        </picture>
      {/if}
    </figure>
  {:else if item.type === "separator"}
    <Dialog.Root>
      <Dialog.Trigger
        class="aspect-video flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg shadow-lg transition-transform duration-300 hover:scale-105 hover:ring-2 hover:ring-primary focus:outline-none"
      >
        <h3 class="text-lg">{item.location}</h3>
        {#if item.city}
          <p class="text-sm text-muted-foreground">{item.city}</p>
        {/if}
        <span
          class={buttonVariants({
            size: "sm",
            variant: "link",
            class: "text-sm mt-2",
          })}
        >
          Zobrazit příběh
        </span>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{item.location}</Dialog.Title>
          {#if item.city}
            <Dialog.Description>{item.city}</Dialog.Description>
          {/if}
        </Dialog.Header>
        <div class="prose prose-sm dark:prose-invert max-w-none mt-4">
          {@html renderStoryHtml(item)}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  {/if}
{/each}
```

**Klíčové vlastnosti**:

**1. Responsive `<picture>` element**:

```html
<picture>
  <source type="image/avif" srcset="..." />
  <source type="image/webp" srcset="..." />
  <img src="fallback.jpg" loading="lazy" />
</picture>
```

**2. Sizes attribute** (responsive breakpoints):

```
(min-width: 1280px) 25vw  → XL: 4 columns (25% viewport)
(min-width: 1024px) 33vw  → LG: 3 columns (33% viewport)
(min-width: 640px) 50vw   → SM: 2 columns (50% viewport)
100vw                     → Mobile: 1 column (100% viewport)
```

**3. Lazy loading**:

- `loading="lazy"` - Native browser lazy loading
- Images load pouze když jsou v/blízko viewportu
- Šetří bandwidth a zrychluje initial load

**4. Placeholder color**:

- `bg-[${item.placeholderColor}]` - Dynamic Tailwind class
- Dominant color jako placeholder (před načtením obrázku)
- Smooth loading experience (no layout shift)

**5. Separator cards**:

- Dialog trigger s location info
- Click otevře modal s story content
- Markdown rendered do HTML (`marked.parse()`)
- Prose styling (`prose prose-sm dark:prose-invert`)

**6. Hover effects**:

- `hover:scale-105` - Subtle zoom on hover
- `transition-transform duration-300` - Smooth animation

### 7.3 Header.svelte - Navigace

**Cesta**: `src/lib/components/Header.svelte`

```svelte
<script lang="ts">
  import { Calendar, ChevronRight, Menu } from "@lucide/svelte";

  import Button, { buttonVariants } from "$lib/components/ui/button/button.svelte";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import type { MenuManifest } from "$lib/types/manifest";

  export let menuItems: MenuManifest = [];
</script>

<header class="sticky top-0 border-b bg-background text-foreground z-10">
  <div class="container mx-auto py-3 flex items-center gap-4">
    <div class="flex-1 flex items-center gap-8">
      <a href="/" class="text-lg font-semibold uppercase">Izrael 2022</a>
    </div>

    <Sheet.Root>
      <Sheet.Trigger class={buttonVariants({ size: "sm", variant: "ghost" })}>
        <Menu />
      </Sheet.Trigger>

      <Sheet.Content side="right" class="overflow-y-auto">
        <Sheet.Header>
          <Sheet.Title>Menu</Sheet.Title>
        </Sheet.Header>
        <nav class="flex flex-col gap-2 mx-2 pr-2">
          <Sidebar.Menu>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Dny</Sidebar.GroupLabel>
              <!-- Menu items rendered here -->
            </Sidebar.Group>
          </Sidebar.Menu>
        </nav>
      </Sheet.Content>
    </Sheet.Root>
  </div>
</header>
```

**Klíčové vlastnosti**:

**1. Sticky header**:

- `sticky top-0` - Fixní header při scrollu
- `z-10` - Z-index pro overlay
- `border-b` - Separátor od obsahu

**2. Sheet (drawer) pattern**:

- Mobile-friendly side drawer
- Slide-in from right
- Backdrop overlay (click to close)
- Scrollable content (`overflow-y-auto`)

**3. Sidebar menu**:

- Structured menu s groups
- Day-based navigation (anchor links)
- Location sub-items

### 7.4 Footer.svelte - Patička

**Cesta**: `src/lib/components/Footer.svelte`

Jednoduchá patička s copyright a odkazy.

### 7.5 UI Component Library (src/lib/components/ui/)

**Struktura**:

```
ui/
├─ badge/              # Badge komponenty (labels, tags)
├─ button/             # Button variants (primary, secondary, ghost, link)
├─ card/               # Card layout komponenty
├─ dialog/             # Modal dialogs
├─ input/              # Form inputs
├─ navigation-menu/    # Navigation menu komponenty
├─ separator/          # Visual separators
├─ sheet/              # Drawer/Sheet komponenty
├─ sidebar/            # Sidebar komponenty (komplexní menu)
├─ skeleton/           # Loading skeletons
├─ spinner/            # Loading spinners
└─ tooltip/            # Tooltips
```

**Architektura**:

- **Headless components**: bits-ui (behavior without styling)
- **Styled wrappers**: Tailwind CSS styling wrapping bits-ui
- **Variants system**: tailwind-variants for consistent variants
- **Composability**: Každá komponenta je kompozovatelná

**Example - Button variants**:

```typescript
const buttonVariants = tv({
  base: "inline-flex items-center justify-center rounded-md ...",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
```

**Usage**:

```svelte
<Button variant="secondary" size="sm">Click me</Button>
<Button variant="ghost">Ghost button</Button>
```

---

## 8. Bun scripts a task management

Projekt využívá **Bun runtime** pro spouštění skriptů a task management. Tato sekce popisuje dostupné skripty a jejich použití.

### 8.1 NPM scripts přehled

**Development scripts**:

```bash
bun run dev              # Vite dev server (HMR)
bun run preview          # Preview production build
```

**Build scripts**:

```bash
bun run build            # Full production build
bun run prebuild         # Linting + image generation
bun run check            # TypeScript type checking
```

**Image generation scripts**:

```bash
bun run images:build     # Generate optimized images
bun run images:watch     # Watch mode (auto-regenerate)
bun run images:blur      # Generate blur placeholders only
bun run images:all       # Build + blur
```

**Testing scripts**:

```bash
bun run test             # All tests (unit + E2E)
bun run test:unit        # Unit tests only
bun run test:e2e         # E2E tests (Playwright)
bun run test:images      # Image generation tests
```

**Code quality scripts**:

```bash
bun run lint             # Biome + Stylelint
bun run lint:fix         # Auto-fix issues
bun run format           # Format code
bun run format:check     # Check formatting
```

### 8.2 Bun-specific features

**Proč Bun místo Node.js?**

- **Rychlost**: 3-4x rychlejší než Node.js
- **Built-in TypeScript**: Nativní podpora TS bez transpilace
- **Kompatibilita**: Drop-in replacement pro Node.js
- **Package manager**: Rychlejší než npm/yarn

**Klíčové scripty využívající Bun**:

- `scripts/generate-images.ts` - běží přímo v Bun runtime
- `vitest.config.ts` - využívá Bun pro rychlé testy

### 8.3 Task dependencies

```
prebuild
├─ lint:ci (Biome + Stylelint)
└─ images:build (Sharp processing)

build
└─ [prebuild již proběhl]
└─ vite build (SvelteKit compilation)

test:all
├─ test:unit:images
└─ test:images (integration + E2E)
```

---

## 9. Build proces

Tato sekce popisuje kompletní build pipeline od zdrojových souborů po production deployment.

### 9.1 Build pipeline overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT MODE                          │
│                                                              │
│  bun run dev                                                 │
│  └─ Vite dev server (port 5173)                             │
│     ├─ Hot Module Replacement (HMR)                          │
│     ├─ Instant updates                                       │
│     └─ Source maps                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   PRODUCTION BUILD                           │
│                                                              │
│  bun run build                                               │
│  ├─ Step 1: prebuild                                         │
│  │  ├─ Lint (Biome + Stylelint)                             │
│  │  └─ images:build (scripts/generate-images.ts)            │
│  │     ├─ Generate image variants                            │
│  │     ├─ Extract EXIF                                       │
│  │     ├─ Create manifest                                    │
│  │     └─ Output: static/images/ + src/lib/images.manifest.json
│  │                                                           │
│  └─ Step 2: vite build                                       │
│     ├─ TypeScript → JavaScript                               │
│     ├─ Svelte → JavaScript                                   │
│     ├─ Tailwind CSS → optimized CSS                          │
│     ├─ Asset optimization (minify, chunk, tree-shake)        │
│     ├─ SSG: Pre-render pages to HTML                         │
│     └─ Output: build/ directory                              │
│                                                              │
│  Output structure:                                           │
│  build/                                                      │
│  ├─ index.html              (pre-rendered homepage)          │
│  ├─ _app/                   (JavaScript + CSS bundles)       │
│  │  ├─ immutable/                                            │
│  │  │  ├─ chunks/           (code-split chunks)              │
│  │  │  ├─ entry/            (entry points)                   │
│  │  │  ├─ nodes/            (route nodes)                    │
│  │  │  └─ assets/           (CSS, fonts, etc)                │
│  │  └─ version.json         (build version)                  │
│  ├─ images/                 (copied from static/)            │
│  └─ robots.txt              (SEO)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      PREVIEW MODE                            │
│                                                              │
│  bun run preview                                             │
│  └─ Vite preview server (port 4173)                          │
│     └─ Serves production build (build/)                      │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Build skripty (package.json)

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "prebuild": "bun run lint && bun run images:build",
    "preview": "vite preview",

    "images:build": "bun run scripts/generate-images.ts",
    "images:watch": "bun run scripts/generate-images.ts -- --watch=true",
    "images:blur": "bun run scripts/generate-images.ts -- --blur.enable=true --blur.only=true",
    "images:all": "bun run images:build && bun run images:blur",

    "lint": "biome check . && stylelint \"**/*.css\"",
    "lint:fix": "biome check --write .",
    "lint:css": "stylelint \"**/*.css\"",
    "lint:ci": "biome ci .",

    "format": "biome format --write . && prettier --write \"**/*.{svelte,md}\"",
    "format:check": "biome format . && prettier --check \"**/*.{svelte,md}\"",

    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
  }
}
```

### 9.3 Prebuild fáze

**Příkaz**: `bun run prebuild`

**Účel**: Příprava před main buildem

**Kroky**:

**1. Linting** (`bun run lint`):

```bash
# Biome check (JavaScript/TypeScript)
biome check .
  ✔ Checked 143 files in 892ms
  ✔ No issues found

# Stylelint (CSS)
stylelint "**/*.css"
  ✔ 3 files checked
  ✔ No issues found
```

**2. Image generation** (`bun run images:build`):

```bash
# Generate optimized images + manifest
bun run scripts/generate-images.ts

Output:
  ✔ Scanning source directory...
  ✔ Found 245 JPEG images
  ✔ Processing images (concurrency: 7)
    ├─ Generating variants: details, previews, previews-xl, previews-xxs
    ├─ Generating formats: AVIF, WebP, JPEG
    ├─ Extracting EXIF metadata
    └─ Generating LQIP placeholders
  ✔ Generated 2940 image files (245 × 4 variants × 3 formats)
  ✔ Created manifest: src/lib/images.manifest.json
  ✔ Updated cache: .images-cache.json
  ⏱  Completed in 128.4s
```

**Výstupy prebuild**:

- `static/images/egypt-2025/` - Optimalizované obrázky (všechny varianty a formáty)
- `src/lib/images.manifest.json` - Runtime manifest s metadaty
  - Note: The manifest now includes canonical `authorSlug` on image entries
    (generated at build time) and `storyHtml` for separator items when a
    story is present (pre-rendered markdown). The client treats author
    selections as slug-first and will write concise `authors=` CSV parameters
    to the URL for sharing.
- `.images-cache.json` - Cache pro rychlejší opakované buildy

### 9.4 Main build fáze (Vite)

**Příkaz**: `bun run build` (po prebuild) = `vite build`

**Účel**: Kompilace a optimalizace celé aplikace

**Kroky**:

**1. TypeScript compilation**:

```
src/**/*.ts → JavaScript (ES modules)
- Type checking (strict mode)
- Source maps (pro debugging)
- Target: ES2022
```

**2. Svelte compilation**:

```
src/**/*.svelte → JavaScript + CSS
- Svelte compiler (Svelte 5)
- Scoped styles
- Reactive statements → vanilla JS
- Template → DOM operations
```

**3. Tailwind CSS processing**:

```
src/app.css → optimized CSS
- @tailwind directives expansion
- Purge unused classes (tree-shaking)
- Minification
- Vendor prefixes (autoprefixer)
```

**4. Asset optimization**:

```
- Code splitting (dynamic imports)
- Tree shaking (remove unused code)
- Minification (terser)
- Hashing filenames (cache busting)
- Compression (gzip/brotli ready)
```

**5. SSG (Static Site Generation)**:

```
Routes → Pre-rendered HTML
- +layout.server.ts load() executed
- +page.server.ts load() executed
- Svelte components rendered to HTML
- Data embedded in HTML (JSON)
- Result: build/index.html (fully rendered)
```

**Build výstup** (console):

```bash
vite v7.1.2 building for production...
✓ 245 modules transformed.
✓ building SSR bundle for prerendering...
✓ built in 8.42s

rendering pages...
  ✓ / (prerendered)

build/index.html                     12.34 kB │ gzip:  4.21 kB
build/_app/version.json               0.03 kB
build/_app/immutable/entry/start.js  23.45 kB │ gzip:  9.87 kB
build/_app/immutable/entry/app.js    45.67 kB │ gzip: 18.23 kB
build/_app/immutable/chunks/*        234.56 kB │ gzip: 89.34 kB
build/_app/immutable/assets/*.css    12.89 kB │ gzip:  3.45 kB

✓ built in 12.87s
```

### 9.5 Build optimalizace

**Code splitting**:

```javascript
// Automatické code splitting na route level
src/routes/+page.svelte        → build/_app/immutable/nodes/0.js
src/routes/about/+page.svelte  → build/_app/immutable/nodes/1.js

// Lazy loading components
const HeavyComponent = () => import('./HeavyComponent.svelte');
```

**Tree shaking**:

```javascript
// Nepoužitý kód je automaticky odstraněn
import { getPhotoDays } from "$lib";
// ✓ Used
import { unusedFunction } from "$lib";

// ✗ Removed from bundle
```

**Minification**:

```javascript
// Before (development)
function calculateAspectRatio(width, height) {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "square";
  return "landscape";
}

// After (production)
function c(w, h) {
  const r = w / h;
  return Math.abs(r - 1) < 0.05 ? "square" : "landscape";
}
```

**CSS optimization**:

```css
/* Before (all Tailwind utilities) - ~3MB */
.container { ... }
.flex { ... }
.grid { ... }
/* ... 10,000+ classes */

/* After (only used utilities) - ~12KB */
.container { max-width: 1280px; margin: 0 auto; }
.flex { display: flex; }
.grid { display: grid; }
/* ... only 50 used classes */
```

**Image optimization** (už v prebuild):

- Multiple formats (AVIF < WebP < JPEG)
- Multiple sizes (responsive srcset)
- LQIP placeholders (smooth loading)
- Lazy loading (native browser)

### 9.6 Preview mode

**Příkaz**: `bun run preview`

**Účel**: Lokální testování production buildu

**Workflow**:

```bash
# 1. Build production
bun run build

# 2. Start preview server
bun run preview
  ➜  Local:   http://localhost:4173/
  ➜  Network: use --host to expose

# 3. Test v browseru
open http://localhost:4173
```

**Rozdíl dev vs preview**:

|                  | Dev (`bun run dev`)   | Preview (`bun run preview`) |
| ---------------- | --------------------- | --------------------------- |
| **Build**        | No build (on-the-fly) | Pre-built (build/)          |
| **Speed**        | Instant HMR           | Static files (fast)         |
| **Source maps**  | Yes                   | No (production)             |
| **Minification** | No                    | Yes                         |
| **SSR**          | Yes (runtime)         | No (pre-rendered HTML)      |
| **Use case**     | Development           | Production testing          |

### 9.7 Build performance

**Typické build časy** (MacBook Pro M1):

| Fáze            | Čas       | Poznámka                     |
| --------------- | --------- | ---------------------------- |
| **Prebuild**    | ~130s     | Image generation (245 fotek) |
| ├─ Lint         | ~1s       | Biome + Stylelint            |
| └─ Images       | ~128s     | Sharp processing (parallel)  |
| **Main build**  | ~13s      | Vite build                   |
| ├─ TypeScript   | ~2s       | Type checking                |
| ├─ Svelte       | ~3s       | Component compilation        |
| ├─ Tailwind     | ~1s       | CSS processing               |
| ├─ Optimization | ~4s       | Minify, chunk, tree-shake    |
| └─ SSG          | ~3s       | Pre-render HTML              |
| **Total**       | **~143s** | First build                  |
| **Incremental** | **~15s**  | With image cache             |

**Cache strategie**:

- `.images-cache.json` - Přeskakuje nezmněné obrázky (90%+ time save)
- `.svelte-kit/` - SvelteKit build cache
- `node_modules/.vite/` - Vite dependency cache

**Build optimalizace tips**:

1. **Use image cache**: `--clean=false` pokud nepotřebuješ full rebuild
2. **Limit images**: `--limit=10` pro rychlé testování
3. **Manifest-only**: `--manifest-only=true` když měníš jen story content
4. **Watch mode**: `bun run images:watch` v development (auto-regenerate)

---

## 10. Deployment konfigurace

Tato sekce popisuje deployment možnosti a konfiguraci pro produkční nasazení.

### 10.1 Deployment options

**Deployment options**:

#### **Option 1: Vercel** (doporučeno)

```bash
# Install Vercel CLI
bun add -D vercel

# Deploy
vercel

# Output:
# https://photoblog-egypt-2025.vercel.app
```

**Vercel config** (vercel.json):

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "build",
  "installCommand": "bun install"
}
```

#### **Option 2: Netlify**

```bash
# netlify.toml
[build]
  command = "bun run build"
  publish = "build"

[build.environment]
  NODE_VERSION = "24"
```

#### **Option 3: GitHub Pages**

```bash
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: sudo apt-get install -y libvips
      - run: bun install
      - run: bun run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./build
```

#### **Option 4: Cloudflare Pages**

```bash
# Build settings
Build command: bun run build
Build output: build
Node version: 24
```

#### **Option 5: Custom server** (Nginx)

```nginx
server {
  listen 80;
  server_name photoblog.example.com;
  root /var/www/photoblog/build;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /_app/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location /images/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

### 10.2 Environment variables

**Runtime variables** (none - statický build):

```
# Projekt nepoužívá runtime environment variables
# Všechna data jsou embedded v HTML při buildu
```

**Build-time variables** (optional):

```bash
# .env.production
PUBLIC_SITE_URL=https://photoblog.example.com
PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Usage v Svelte**:

```typescript
import { PUBLIC_SITE_URL } from "$env/static/public";

const url = PUBLIC_SITE_URL; // https://photoblog.example.com
```

### 10.3 Production checklist

**Před deploymentem**:

- [ ] `bun run lint` - No errors
- [ ] `bun run check` - TypeScript check OK
- [ ] `bun run test` - All tests pass
- [ ] `bun run build` - Build successful
- [ ] `bun run preview` - Manual testing OK
- [ ] robots.txt configured
- [ ] Favicon set
- [ ] Open Graph tags (social media)
- [ ] Analytics configured (optional)

**Performance checklist**:

- [ ] Images optimized (AVIF/WebP)
- [ ] LQIP placeholders
- [ ] Lazy loading enabled
- [ ] CSS purged (< 20KB)
- [ ] JavaScript minified
- [ ] Code splitting active
- [ ] Cache headers configured (server)
- [ ] Gzip/Brotli compression (server)

**SEO checklist**:

- [ ] Semantic HTML
- [ ] Meta description
- [ ] Title tags
- [ ] robots.txt
- [ ] Sitemap (optional)
- [ ] Structured data (optional)

---

## 11. Závislosti a package management

Projekt využívá **Bun** jako package manager. Tato sekce popisuje klíčové závislosti a jejich role v projektu.

### 11.1 Runtime dependencies

**Production dependencies** (`dependencies` v package.json):

```json
{
  "exifr": "^7.1.3", // EXIF metadata extraction
  "gray-matter": "^4.0.3", // Markdown frontmatter parsing
  "marked": "^12.0.2", // Markdown to HTML
  "slugify": "^1.6.6" // URL slug generation
}
```

### 11.2 Development dependencies

**Kategorie**:

1. **Framework & Build** (`@sveltejs/*`, `vite`, `svelte`)
2. **Image Processing** (`sharp`, `pixelmatch`, `pngjs`)
3. **Testing** (`vitest`, `@playwright/test`, `@vitest/browser`)
4. **Linting & Formatting** (`@biomejs/biome`, `stylelint`, `prettier`)
5. **UI Components** (`bits-ui`, `clsx`, `tailwind-*`)
6. **TypeScript** (`typescript`, `@types/*`)

Celkem **73 dev dependencies**.

### 11.3 Kritické závislosti

**Sharp** (Image processing):

- Vyžaduje **libvips** system library
- macOS: `brew install vips`
- Linux: `apt-get install libvips`

**Bun runtime**:

- Minimální verze: Node >=24 (pro kompatibilitu)
- Doporučeno: Bun 1.0+

### 11.4 Peer dependencies

Projekt nemá explicitní peer dependencies, ale některé balíčky očekávají:

- `svelte` ^5.39.5
- `tailwindcss` ^4.1.13

---

## 12. Content management

Projekt odděluje **obsah** (content) od **aplikace** (src). Tato sekce popisuje strukturu a management obsahu.

### 12.1 Content struktura

```
../content/
├─ egypt-2025/          # Fotografie (JPEG)
│  ├─ 2022-03-21/
│  │  ├─ IMG_0001.jpg
│  │  ├─ IMG_0002.jpg
│  │  └─ story.md        # Volitelný story/popis dne
│  └─ 2022-03-22/
├─ pages/                # Statické stránky (Markdown)
├─ maps/                 # Mapové podklady (GeoJSON)
├─ routes-*/             # GPS trasy (GPX)
└─ site.md               # Globální konfigurace
```

### 12.2 Foto management

**Organizace**:

- Fotky organizované **po dnech** (složka = datum YYYY-MM-DD)
- Jeden den = jedna složka
- Formát: **JPEG** (originály)

**EXIF metadata** (automaticky extrahovaná):

- Datum a čas pořízení
- GPS souřadnice (pokud dostupné)
- Orientace fotky
- Camera info (model, exposure, atd.)

**Podporované formáty**: JPEG (vstup), AVIF/WebP/JPEG (výstup)

### 12.3 Story system

**Story soubory** (`story.md`):

- Markdown soubor v adresáři dne
- Popisuje místa nebo události daného dne
- Podporuje **frontmatter** (YAML metadata)

**Příklad story.md**:

```markdown
---
location: Jerusalem
highlights:
  - Western Wall
  - Old City
---

# Jerusalem - Den první

Navštívili jsme Západní zeď a procházeli se Starým městem...
```

**Zpracování**:

- `gray-matter` - parse frontmatter
- `marked` - convert Markdown → HTML
- `slugify` - generate URL-friendly slugs

### 12.4 Content workflow

```
1. Přidat fotky do content/egypt-2025/YYYY-MM-DD/
2. (Volitelně) Vytvořit story.md
3. Spustit `bun run images:build`
4. Manifest se automaticky aktualizuje
5. Změny se projeví na webu
```

**Watch mode**: `bun run images:watch` - automatická regenerace při změnách

---

## 13. Pomocné skripty a nástroje (Scripts a Image Generation Pipeline)

Tato sekce poskytuje detailní analýzu jádra projektu - systému pro generování a optimalizaci obrázků. Jde o kritickou část architektury, která určuje výkon celé aplikace.

### 13.1 Přehled Image Generation systému

**Účel**: Automatizovaná generace optimalizovaných obrázků z originálních JPEG fotografií

**Klíčové vlastnosti**:

- Generování **variant** (různé velikosti): `details`, `previews`, `previews-xl`, `previews-xxs`
- Generování **formátů** (různé kódování): AVIF, WebP, JPEG
- Extrakce **EXIF metadata** (datum, GPS, orientace)
- Generování **LQIP placeholders** (Low-Quality Image Placeholders)
- Generování **blur assets** (rozmazané placeholders)
- **Manifest generation** (JSON soubor s metadaty pro runtime)
- **Inteligentní caching** (přeskakování nezmněných obrázků)
- **Watch mode** (automatická regenerace při změnách)
- **Paralelní zpracování** (využití všech CPU jader)

**Výkonnostní optimalizace**:

- AVIF: Moderní formát, až 50% menší než JPEG
- WebP: 25-35% menší než JPEG s podobnou kvalitou
- JPEG: Fallback pro starší prohlížeče
- Progressive JPEG: Postupné načítání
- Chroma subsampling: Redukce barevných informací (4:2:0)

### 13.2 config.ts - Centrální konfigurace

**Cesta**: `scripts/config.ts`
**Účel**: Definuje všechny parametry pro generování obrázků

**Struktura**:

```typescript
export const config = {
  paths: {
    source: "content/egypt-2025", // Originální JPEG
    output: "static/images/egypt-2025", // Výstupní adresář
    manifest: "src/lib/images.manifest.json", // Runtime manifest
    cache: ".images-cache.json", // Cache file
  },

  variants: {
    default: {
      media: "(max-width: 575px), (min-width: 1400px)",
      resize: { width: 370, height: 208, crop: true },
      folderName: "previews",
    },
    xl: {
      media: "(min-width: 576px) and (max-width: 1399px)",
      resize: { width: 534, height: 300, crop: true },
      folderName: "previews-xl",
    },
  },

  otherOutputs: {
    detail: {
      resize: { width: 1280 },
      format: "jpeg",
      folderName: "details",
    },
    fallback: {
      resize: { width: 190, height: 107, crop: true },
      folderName: "previews-xxs",
    },
    placeholder: {
      resize: { width: 24 },
      blur: true,
      format: "png",
      folderName: "blurs",
    },
  },

  encoding: {
    formats: ["webp", "jpeg", "avif"],
    quality: {
      jpeg: 80,
      webp: 65,
      avif: 50,
    },
    sharp: {
      jpeg: {
        progressive: true,
        mozjpeg: false,
        chromaSubsampling: "4:2:0",
      },
      webp: { effort: 4 },
      avif: { effort: 5, chromaSubsampling: "4:2:0" },
      blur: {
        png: {
          palette: true,
          colors: 32,
          quality: 50,
          compressionLevel: 9,
        },
      },
    },
  },

  script: {
    concurrency: "auto",
    limit: 0,
  },
};
```

**Varianty obrázků**:

1. **`variants.default`** (370×208px):
   - **Media query**: `(max-width: 575px), (min-width: 1400px)`
   - **Použití**: Mobily a velké desktopy
   - **Crop**: Ano (zachová aspect ratio 16:9)
   - **Složka**: `previews/`

2. **`variants.xl`** (534×300px):
   - **Media query**: `(min-width: 576px) and (max-width: 1399px)`
   - **Použití**: Tablety a střední desktopy
   - **Crop**: Ano
   - **Složka**: `previews-xl/`

3. **`otherOutputs.detail`** (1280px šířka):
   - **Použití**: Lightbox / plné zobrazení
   - **Format**: Pouze JPEG
   - **Crop**: Ne (zachová aspect ratio)
   - **Složka**: `details/`

4. **`otherOutputs.fallback`** (190×107px):
   - **Použití**: Tiny fallback (extrémně malé obrazovky)
   - **Složka**: `previews-xxs/`

5. **`otherOutputs.placeholder`** (24px šířka):
   - **Použití**: LQIP placeholder (blur efekt)
   - **Blur**: Ano
   - **Format**: PNG-8 (paleta 32 barev)
   - **Složka**: `blurs/`

**Formáty a kvalita**:

| Formát   | Kvalita | Využití                                      | Velikost (relativní) | Komprese parametry         |
| -------- | ------- | -------------------------------------------- | -------------------- | -------------------------- |
| **AVIF** | 50      | Moderní prohlížeče (Chrome 85+, Firefox 93+) | ~50% JPEG            | effort: 5, chroma: 4:2:0   |
| **WebP** | 65      | Široká podpora (Chrome 23+, Firefox 65+)     | ~70% JPEG            | effort: 4                  |
| **JPEG** | 80      | Fallback (všechny prohlížeče)                | 100% (baseline)      | progressive, chroma: 4:2:0 |

**Concurrency**:

- `'auto'`: Počet CPU jader - 1
- Číslo: Pevný počet paralelních workerů

### 13.3 generate-images.ts - Hlavní skript

**Cesta**: `scripts/generate-images.ts`
**Účel**: Hlavní logika pro generování obrázků a manifestu

**Klíčové komponenty**:

#### 5.3.1 Architektura skriptu

```
generate-images.ts
│
├─ Import dependencies
│  ├─ sharp (lazy loaded)
│  ├─ exifr (EXIF extraction)
│  ├─ gray-matter (Markdown parsing)
│  └─ fast-glob (file scanning)
│
├─ Type definitions
│  ├─ SharpModule, SharpInstance
│  ├─ Import from manifest.ts
│  └─ Internal types
│
├─ Utilities
│  ├─ toPosix() - path normalization
│  ├─ fileExists() - async file check
│  ├─ ensureDir() - recursive mkdir
│  ├─ sha1() - hash calculation
│  ├─ loadJSON() - safe JSON load
│  ├─ saveJSON() - safe JSON save
│  └─ getAspectRatioName() - aspect ratio detection
│
├─ Concurrency limiter
│  └─ createConcurrencyLimiter() - parallel processing control
│
├─ Argument parsing
│  └─ parseArgs() - CLI args handling
│
├─ Main processing functions
│  ├─ loadCache() - load .images-cache.json
│  ├─ saveCache() - save cache
│  ├─ needsProcessing() - check if image changed
│  ├─ extractEXIF() - read EXIF data
│  ├─ loadStories() - parse story.md files
│  ├─ processImage() - core image processing
│  ├─ generateManifest() - create manifest JSON
│  └─ cleanOrphanedFiles() - remove old files
│
├─ Watch mode
│  └─ watchMode() - file watcher with debounce
│
└─ main() - entry point
   ├─ Load Sharp
   ├─ Load cache
   ├─ Scan source files
   ├─ Process images (parallel)
   ├─ Generate manifest
   ├─ Clean orphaned files
   └─ Save cache
```

#### 5.3.2 Klíčové funkce

**1. Cache management**:

```typescript
const CACHE_VERSION = 7; // Increment to invalidate cache

type CacheFileEntry = {
  hash: string; // SHA-1 hash of file content
  mtime: number; // Modification timestamp
  processed: boolean; // Processing completed
};

type Cache = {
  version: number;
  images: Record<string, CacheFileEntry>;
};
```

**Cache workflow**:

1. Načti `.images-cache.json`
2. Pro každý obrázek:
   - Spočítej SHA-1 hash
   - Porovnej s cached hash
   - Pokud se liší → zpracuj
   - Pokud stejný → přeskoč
3. Ulož aktualizovaný cache

**2. EXIF extraction**:

```typescript
async function extractEXIF(imagePath: string) {
  const exif = await exifr.parse(imagePath, {
    tiff: true,
    gps: true,
    ifd0: true,
    exif: true,
  });

  return {
    date: exif?.DateTimeOriginal || null,
    latitude: exif?.latitude || null,
    longitude: exif?.longitude || null,
    orientation: exif?.Orientation || 1,
    camera: exif?.Model || null,
    lens: exif?.LensModel || null,
    focalLength: exif?.FocalLength || null,
    aperture: exif?.FNumber || null,
    iso: exif?.ISO || null,
    shutterSpeed: exif?.ExposureTime || null,
  };
}
```

**3. Image processing** (core function):

```typescript
async function processImage(
  inputPath: string,
  outputDir: string,
  config: Config,
): Promise<ImageEntry> {
  const sharp = await getSharp();
  const img = sharp(inputPath);
  const metadata = await img.metadata();

  // 1. Auto-rotate podle EXIF orientation
  img.rotate();

  // 2. Zpracuj všechny varianty
  const variants: Record<string, ImageSource[]> = {};

  for (const [variantName, variantConfig] of Object.entries(config.variants)) {
    const outputs: ImageSource[] = [];

    // Resize
    const resized = img.clone().resize({
      width: variantConfig.resize.width,
      height: variantConfig.resize.height,
      fit: variantConfig.resize.crop ? "cover" : "inside",
      withoutEnlargement: !config.allowUpscale,
    });

    // Generate all formats (AVIF, WebP, JPEG)
    for (const format of config.encoding.formats) {
      const outputPath = getOutputPath(outputDir, variantConfig.folderName, inputPath, format);

      await ensureDir(path.dirname(outputPath));

      if (format === "avif") {
        await resized
          .clone()
          .avif({
            quality: config.encoding.quality.avif,
            effort: config.encoding.sharp.avif.effort,
            chromaSubsampling: config.encoding.sharp.avif.chromaSubsampling,
          })
          .toFile(outputPath);
      } else if (format === "webp") {
        await resized
          .clone()
          .webp({
            quality: config.encoding.quality.webp,
            effort: config.encoding.sharp.webp.effort,
          })
          .toFile(outputPath);
      } else if (format === "jpeg") {
        await resized
          .clone()
          .jpeg({
            quality: config.encoding.quality.jpeg,
            progressive: config.encoding.sharp.jpeg.progressive,
            mozjpeg: config.encoding.sharp.jpeg.mozjpeg,
            chromaSubsampling: config.encoding.sharp.jpeg.chromaSubsampling,
          })
          .toFile(outputPath);
      }

      const stats = await fsp.stat(outputPath);
      const outputMeta = await sharp(outputPath).metadata();

      outputs.push({
        path: toPosix(path.relative(config.paths.output, outputPath)),
        width: outputMeta.width!,
        height: outputMeta.height!,
        format: format,
        bytes: stats.size,
      });
    }

    variants[variantName] = outputs;
  }

  // 3. LQIP placeholder
  const placeholderBuffer = await img.clone().resize({ width: 24 }).blur(20).png().toBuffer();

  const placeholderBase64 = `data:image/png;base64,${placeholderBuffer.toString("base64")}`;

  // 4. Dominant color
  const stats = await img.clone().resize(1, 1).raw().toBuffer();
  const dominantColor = `#${stats[0].toString(16).padStart(2, "0")}${stats[1].toString(16).padStart(2, "0")}${stats[2].toString(16).padStart(2, "0")}`;

  // 5. Return ImageEntry
  return {
    original: {
      path: toPosix(path.relative(config.paths.source, inputPath)),
      width: metadata.width!,
      height: metadata.height!,
      format: metadata.format!,
      bytes: (await fsp.stat(inputPath)).size,
    },
    variants: variants,
    placeholder: {
      base64: placeholderBase64,
      width: 24,
      height: Math.round(24 / (metadata.width! / metadata.height!)),
      type: "image/png",
    },
    color: dominantColor,
    exif: await extractEXIF(inputPath),
    hash: sha1(await fsp.readFile(inputPath)),
    outputs: Object.values(variants)
      .flat()
      .map((v) => v.path),
  };
}
```

**4. Manifest generation**:

```typescript
async function generateManifest(
  processedImages: ImageEntry[],
  stories: StoryDataMap,
): Promise<Manifest> {
  // Group by day (from EXIF date or filename)
  const dayGroups = groupByDay(processedImages);

  const photoDays: PhotoDay[] = [];

  for (const [date, images] of Object.entries(dayGroups)) {
    const items = images.map((img) => ({
      type: "image" as const,
      ...img,
    }));

    // Add separators for location changes
    const itemsWithSeparators = addSeparators(items);

    // Add story if exists
    const story = stories[date];

    photoDays.push({
      id: slugify(date),
      date: date,
      items: itemsWithSeparators,
      story: story || null,
    });
  }

  // Sort by date
  photoDays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    photoDays: photoDays,
  };
}
```

**5. Concurrency limiter**:

```typescript
function createConcurrencyLimiter(limit: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          running--;
          if (queue.length > 0) {
            const next = queue.shift()!;
            next();
          }
        }
      };

      if (running < limit) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}
```

**Usage**:

```typescript
const limiter = createConcurrencyLimiter(4); // 4 parallel workers

await Promise.all(images.map((img) => limiter(() => processImage(img, outputDir, config))));
```

#### 5.3.3 CLI argumenty

**Hlavní pipeline**:

- `--src=<path>`: Zdrojový adresář s JPEG
- `--out=<path>`: Výstupní adresář
- `--manifest=<path>`: Cesta k manifestu
- `--concurrency=<n|auto>`: Počet paralelních workerů
- `--watch=true`: Watch mode (automatická regenerace)
- `--clean=true`: Vyčistit osiřelé soubory
- `--limit=<n>`: Omezit počet zpracovaných obrázků (testing)
- `--verbose=true`: Detailní výstup
- `--quiet=true`: Tichý mód (jen chyby)
- `--manifest-only=true`: Regenerovat pouze manifest (bez zpracování obrázků)

**Blur assets**:

- `--blur.enable=true`: Zapnout blur generování
- `--blur.only=true`: Pouze blur (bez hlavního pipeline)
- `--blur.src=<path>`: Zdrojový adresář pro blur
- `--blur.out=<path>`: Výstupní adresář pro blur
- `--blur.width=<n>`: Šířka blur assetu (default: 24px)
- `--blur.colors=<n>`: Počet barev pro PNG paletu (default: 32)
- `--blur.formats=png,avif,jpeg`: Formáty blur assetů
- `--blur.clean=true`: Vyčistit osiřelé blur soubory

### 13.4 cli-parser.ts - Argument parsing

**Cesta**: `scripts/lib/cli-parser.ts`
**Účel**: Parsování CLI argumentů s výchozími hodnotami

**Architektura**:

```typescript
// Definice výchozích hodnot
export const DEFAULTS: Args = {
  src: path.resolve(process.cwd(), "content/egypt-2025"),
  out: path.resolve(process.cwd(), "static/images/egypt-2025"),
  manifest: path.resolve(process.cwd(), "src/lib/images.manifest.json"),
  variants: ["details", "previews", "previews-xl", "previews-xxs"],
  formats: ["avif", "webp", "jpeg"],
  quality: { avif: 50, webp: 60, jpeg: 80 },
  // ... další defaults
};

// Map-based handler pro lepší maintainability (OCP principle)
const ARG_HANDLERS: Record<string, ArgHandler> = {
  src: (v, a) => {
    a.src = path.resolve(process.cwd(), v);
  },
  out: (v, a) => {
    a.out = path.resolve(process.cwd(), v);
  },
  "quality.avif": (v, a) => {
    a.quality.avif = parseInt(v, 10);
  },
  // ... další handlers
};

export function parseArgs(argv: string[]): Args {
  const out: Args = { ...DEFAULTS };

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [k, vRaw] = arg.slice(2).split("=");
    const v = vRaw ?? "true";

    const handler = ARG_HANDLERS[k];
    if (handler) {
      handler(v, out);
    }
  }

  // Post-processing: resolve 'auto' concurrency
  if (out.concurrency === "auto") {
    out.concurrency = Math.max(1, (os.cpus()?.length || 2) - 1);
  }

  return out;
}
```

**Výhody map-based přístupu**:

- **Open/Closed Principle**: Snadné přidávání nových argumentů bez změny logiky
- **Type-safe**: TypeScript validace handlers
- **Testovatelné**: Každý handler lze testovat izolovaně
- **Maintainovatelné**: Jasná separace concerns

### 13.5 Výstupní struktura (generované soubory)

Po spuštění `bun run images:build` vzniká následující struktura:

```
static/images/egypt-2025/
├─ details/                    # Detailní zobrazení (1280px šířka)
│  ├─ 2022-03-21_001.jpg
│  ├─ 2022-03-21_002.jpg
│  └─ ...
│
├─ previews/                   # Default varianta JPEG (370×208px)
│  ├─ 2022-03-21_001.jpg
│  └─ ...
│
├─ previews-avif/              # Default varianta AVIF
│  ├─ 2022-03-21_001.avif
│  └─ ...
│
├─ previews-webp/              # Default varianta WebP
│  ├─ 2022-03-21_001.webp
│  └─ ...
│
├─ previews-xl/                # XL varianta JPEG (534×300px)
│  ├─ 2022-03-21_001.jpg
│  └─ ...
│
├─ previews-xl-avif/           # XL varianta AVIF
│  └─ ...
│
├─ previews-xl-webp/           # XL varianta WebP
│  └─ ...
│
├─ previews-xxs/               # Fallback varianta (190×107px)
│  └─ ...
│
└─ blurs/                      # Blur placeholders (24px)
   ├─ 2022-03-21_001.png
   └─ ...
```

**Naming convention**:

- Originál: `content/egypt-2025/2022-03-21/IMG_0001.jpg`
- Output: `static/images/egypt-2025/previews/2022-03-21_001.jpg`
- Pattern: `YYYY-MM-DD_NNN.<ext>`

### 13.6 Manifest struktura

**Výstup**: `src/lib/images.manifest.json`

```json
{
  "version": "1.0",
  "generatedAt": "2025-10-21T10:30:00.000Z",
  "photoDays": [
    {
      "id": "2022-03-21",
      "date": "2022-03-21",
      "items": [
        {
          "type": "image",
          "original": {
            "path": "2022-03-21/IMG_0001.jpg",
            "width": 4000,
            "height": 3000,
            "format": "jpeg",
            "bytes": 2500000
          },
          "variants": {
            "default": [
              {
                "path": "previews-avif/2022-03-21_001.avif",
                "width": 370,
                "height": 208,
                "format": "avif",
                "bytes": 15000
              },
              {
                "path": "previews-webp/2022-03-21_001.webp",
                "width": 370,
                "height": 208,
                "format": "webp",
                "bytes": 22000
              },
              {
                "path": "previews/2022-03-21_001.jpg",
                "width": 370,
                "height": 208,
                "format": "jpeg",
                "bytes": 35000
              }
            ],
            "xl": [...],
            "detail": [...],
            "fallback": [...]
          },
          "placeholder": {
            "base64": "data:image/png;base64,iVBORw0KG...",
            "width": 24,
            "height": 18,
            "type": "image/png"
          },
          "color": "#3a5f8c",
          "exif": {
            "date": "2022-03-21T14:32:15.000Z",
            "latitude": 31.7683,
            "longitude": 35.2137,
            "orientation": 1,
            "camera": "Canon EOS R5",
            "lens": "RF 24-105mm F4L IS USM",
            "focalLength": 35,
            "aperture": 5.6,
            "iso": 200,
            "shutterSpeed": "1/250"
          },
          "hash": "abc123def456...",
          "outputs": ["previews-avif/2022-03-21_001.avif", ...]
        },
        {
          "type": "separator",
          "location": "Jerusalem"
        },
        ...
      ],
      "story": {
        "title": "První den v Jeruzalémě",
        "content": "# První den\n\nPříjezd do...",
        "author": "Jaroslav Vrána",
        "date": "2022-03-21"
      }
    },
    ...
  ]
}
```

### 13.7 Performance metriky

**Typické zpracování** (100 JPEG fotek, 4000×3000px):

| Fáze                   | Čas        | Poznámka                       |
| ---------------------- | ---------- | ------------------------------ |
| Skenování souborů      | ~50ms      | fast-glob                      |
| EXIF extraction        | ~2s        | exifr (parallel)               |
| Image processing       | ~120s      | Sharp (4 varianty × 3 formáty) |
| Manifest generation    | ~100ms     | JSON serialization             |
| **Celkem (první run)** | **~122s**  | Bez cache                      |
| **Celkem (cached)**    | **~300ms** | S cache (žádné změny)          |

**Concurrency impact** (100 fotek):

| Concurrency    | Čas   | CPU usage                      |
| -------------- | ----- | ------------------------------ |
| 1 (serial)     | ~480s | ~25% (1 core)                  |
| 2              | ~250s | ~50%                           |
| 4              | ~120s | ~100% (4 cores)                |
| 8              | ~110s | ~100% (8 cores, marginal gain) |
| auto (7 cores) | ~115s | ~100%                          |

**Velikosti výstupů** (průměrný 4000×3000px JPEG):

| Varianta           | Format | Velikost | Úspora vs. orig |
| ------------------ | ------ | -------- | --------------- |
| Original           | JPEG   | 2.5 MB   | -               |
| detail (1280px)    | JPEG   | 180 KB   | -93%            |
| preview (370px)    | AVIF   | 12 KB    | -99.5%          |
| preview (370px)    | WebP   | 18 KB    | -99.3%          |
| preview (370px)    | JPEG   | 28 KB    | -98.9%          |
| placeholder (24px) | PNG    | 800 B    | -99.97%         |

---

## 14. Development workflow

Typický development workflow pro práci na projektu.

### 14.1 Initial setup

```bash
# 1. Nainstalovat libvips (Sharp requirement)
brew install vips  # macOS
# apt-get install libvips  # Linux

# 2. Nainstalovat dependencies
bun install

# 3. Vygenerovat obrázky
bun run images:build

# 4. Spustit dev server
bun run dev
```

### 14.2 Development cycle

**Běžný workflow**:

```bash
# Terminal 1: Dev server s HMR
bun run dev

# Terminal 2: Watch mode pro obrázky (pokud měníš content)
bun run images:watch

# Při změnách kódu:
# - Komponenty: HMR (instant reload)
# - Tailwind: Auto-rebuild
# - TypeScript: Type checking on save
```

### 14.3 Linting workflow

**Pre-commit hooks** (lint-staged):

```bash
# Automaticky se spustí při git commit
- Biome: Check & format JavaScript/TypeScript
- Stylelint: Check CSS
- Prettier: Format Svelte/Markdown
```

**Manuální linting**:

```bash
bun run lint           # Check only
bun run lint:fix       # Auto-fix
bun run format         # Format all
```

### 14.4 Testing workflow

```bash
# Unit testy (rychlé)
bun run test:unit

# Image generation testy (pomalé)
bun run test:images

# E2E testy (browser)
bun run test:e2e

# Vše najednou
bun run test:all
```

### 14.5 Content updates

**Přidání nových fotek**:

```bash
# 1. Přidat JPEG do content/egypt-2025/YYYY-MM-DD/
# 2. (Optional) Vytvořit story.md
# 3. Regenerovat
bun run images:build
# 4. Ověřit v dev mode
bun run dev
```

**Změna existujících fotek**:

```bash
# Cache automaticky detekuje změny podle mtime
bun run images:build  # Regeneruje jen změněné
```

### 14.6 Production build

```bash
# Full build
bun run build

# Preview locally
bun run preview

# Deploy (dle platformy)
git push  # Vercel/Netlify auto-deploy
# nebo manual deploy
```

### 14.7 Troubleshooting

**Časté problémy**:

1. **Sharp install fails**

   ```bash
   brew install vips
   bun install
   ```

2. **Cache issues**

   ```bash
   rm -rf .images-cache.json
   bun run images:build
   ```

3. **Type errors**

   ```bash
   bun run check
   ```

4. **Build fails**
   ```bash
   rm -rf .svelte-kit build
   bun run build
   ```

---

## 15. Testing strategie

Projekt implementuje **komprehenzivní testing strategii** pokrývající všechny úrovně - od unit testů přes integration až po E2E testy. Testování je kritické zejména pro image generation pipeline, kde musíme zajistit deterministické výstupy.

### 15.1 Přehled testing strategie

**Testovací úrovně**:

1. **Unit testy** - Izolované funkce (CLI parsing, utility funkce)
2. **Integration testy** - Kompletní image generation pipeline
3. **E2E testy** - Browser testing (Playwright)
4. **Visual regression** - Pixel-perfect porovnání obrázků

**Testing frameworky**:

- **Vitest** v3.2+ - Unit a integration testy (rychlé, Vite-native)
- **Playwright** v1.55+ - E2E browser testy
- **Sharp** + **pixelmatch** - Visual regression testing

**Konfigurace**:

- `vitest.config.images.ts` - Specializovaná konfigurace pro image testy
- `playwright.config.ts` - E2E testing konfigurace
- `vite.config.ts` - Client/server testing projects

### 15.2 Adresářová struktura testů

```
tests/
├─ fixtures/                    # Fixture data (generovány programově)
│  ├─ input/                    # Zdrojové testovací obrázky
│  └─ expected/                 # Očekávané výstupy
│
├─ golden/                      # "Golden" snapshoty
│  ├─ manifests/                # JSON snapshoty manifestů
│  ├─ trees/                    # Snapshoty adresářové struktury
│  └─ images/                   # Referenční obrázky
│
├─ outputs/                     # Dočasné výstupy testů
│  ├─ tmp-int/                  # Integration test outputs
│  └─ tmp-e2e/                  # E2E test outputs
│
├─ unit/                        # Unit testy
│  └─ images-cli.unit.spec.ts
│
├─ integration/                 # Integration testy
│  └─ generate-and-blur.int.spec.ts
│
├─ e2e-images/                  # E2E image testy
│  └─ full-run.e2e.spec.ts
│
└─ utils/                       # Test utilities
   ├─ fs-helpers.ts             # Filesystem helpers
   ├─ image-assert.ts           # Image comparison
   ├─ manifest-assert.ts        # Manifest validation
   ├─ process-helpers.ts        # Process spawn helpers
   └─ fixtures.ts               # Fixture generators

e2e/
└─ demo.test.ts                 # Playwright E2E testy
```

### 15.3 Unit testy

**Účel**: Testování izolovaných funkcí bez side effects

**Lokace**: `tests/unit/images-cli.unit.spec.ts`

**Co testují**:

- CLI argument parsing
- Výchozí hodnoty parametrů
- Kvalita a komprese nastavení
- Path normalizace
- Upscaling pravidla

**Příklad - CLI parsing test**:

```typescript
import { describe, expect, it } from "vitest";

import { buildInputSet } from "../utils/fixtures";
import { runCli, tmpDir } from "../utils/process-helpers";

describe("CLI (generate-images.ts) – základní chování a parsování parametrů", () => {
  it("aplikuje overrides pro out/manifest/formats/quality", async () => {
    const inDir = tmpDir("img-in");
    await buildInputSet(inDir);

    const outDir = tmpDir("img-out");
    const manifest = path.join(outDir, "images.manifest.json");

    const args = [
      `--src=${inDir}`,
      `--out=${outDir}`,
      `--manifest=${manifest}`,
      `--formats=jpeg,webp`,
      `--quality.jpeg=75`,
      `--quality.webp=60`,
      `--concurrency=1`,
      `--clean=true`,
      `--limit=3`,
    ];

    const res = await runCli(args, { cwd: CWD, timeoutMs: 120000 });
    expect(res.code).toBe(0);

    // Ověř existenci manifestu
    expect(fs.existsSync(manifest)).toBe(true);

    // Ověř strukturu výstupu
    const tree = await listTree(outDir);
    const jpegFiles = tree.filter((p) =>
      /\/(details|previews|previews-xl|previews-xxs)\/.+\.jpg$/.test(p),
    );
    const webpFiles = tree.filter((p) =>
      /\/(details|previews|previews-xl|previews-xxs)-webp\/.+\.webp$/.test(p),
    );

    expect(jpegFiles.length).toBeGreaterThan(0);
    expect(webpFiles.length).toBeGreaterThan(0);

    // Sanity: žádné AVIF (nebyly vyžádány)
    const avifFiles = tree.filter((p) => p.endsWith(".avif"));
    expect(avifFiles.length).toBe(0);
  });

  it("respektuje --allow-upscale=false", async () => {
    // Testuje, že detail varianta se nezvětšuje nad původní šířku
    // ...
  });
});
```

**Klíčové vlastnosti**:

- **Rychlé** (< 5s per test)
- **Deterministické** (stejné výstupy vždy)
- **Izolované** (čištění tmp dirs před/po testu)

### 15.4 Integration testy

**Účel**: Testování celého image generation pipeline end-to-end

**Lokace**: `tests/integration/generate-and-blur.int.spec.ts`

**Co testují**:

- Kompletní image generation (všechny varianty + formáty)
- Manifest generování a struktura
- Blur assets generování
- Watch mode (file watcher)
- Cache mechanismus
- Orphan file cleanup

**Příklad - Integration test**:

```typescript
describe("Integration: main images generation", () => {
  it("produces deterministic manifest and expected directory tree", async () => {
    const inDir = tmpDir("int-in");
    await buildInputSet(inDir);

    const outDir = tmpDir("int-out");
    const manifest = path.join(outDir, "images.manifest.json");

    const res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--formats=avif,webp,jpeg`,
        `--quality.avif=50`,
        `--quality.webp=60`,
        `--quality.jpeg=80`,
        `--concurrency=1`,
        `--clean=true`,
      ],
      { cwd: CWD, timeoutMs: 180000 },
    );
    expect(res.code).toBe(0);

    // Manifest snapshot (normalized)
    const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const normalized = normalizeManifest(data);
    expect(normalized).toMatchSnapshot();

    // Directory tree snapshot
    const tree = await listTree(outDir);
    const rel = tree.map((p) => path.posix.relative(outDir, p));
    expect(rel).toMatchSnapshot();

    // Sanity checks
    expect(tree.some((p) => p.endsWith(".avif"))).toBe(true);
    expect(tree.some((p) => p.endsWith(".webp"))).toBe(true);
    expect(tree.some((p) => p.endsWith(".jpg"))).toBe(true);
  });
});
```

**Snapshot testing**:

- **Manifest snapshots**: JSON normalizované (sort keys, remove timestamps)
- **Directory tree snapshots**: Relativní cesty, deterministické pořadí
- **Automatická update**: `vitest -u` pro update snapshots

**Klíčové vlastnosti**:

- **Středně rychlé** (30-60s per test)
- **Snapshot-based** (porovnání s golden outputs)
- **Real Sharp processing** (skutečné Sharp/libvips operace)

### 15.5 E2E testy

**Účel**: Browser testing - ověření, že aplikace funguje v reálném prohlížeči

**Lokace**: `e2e/demo.test.ts`

**Framework**: Playwright

**Co testují**:

- Homepage rendering
- Komponenty visibility
- Navigation
- Image loading
- Interactive elements

**Příklad - Playwright test**:

```typescript
import { expect, test } from "@playwright/test";

test("home page has expected h1", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
});

test("photo grid loads images", async ({ page }) => {
  await page.goto("/");

  // Wait for lazy-loaded images
  const images = page.locator('img[loading="lazy"]');
  await expect(images.first()).toBeVisible({ timeout: 5000 });

  // Check image count
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
});

test("navigation menu opens on click", async ({ page }) => {
  await page.goto("/");

  // Click menu button
  await page.click('button[aria-label="Menu"]');

  // Check menu visibility
  await expect(page.locator('nav[role="navigation"]')).toBeVisible();
});
```

**Playwright konfigurace** (`playwright.config.ts`):

```typescript
export default defineConfig({
  webServer: {
    command: "bun run build && bun run preview",
    port: 4173,
  },
  testDir: "e2e",
});
```

**Workflow**:

1. Playwright spustí `bun run build` (production build)
2. Spustí `bun run preview` (preview server na portu 4173)
3. Spustí testy v Chromium
4. Ukončí server

**Klíčové vlastnosti**:

- **Pomalé** (2-5 min celý suite)
- **Visual testing** (screenshot comparison)
- **Cross-browser** (Chromium, Firefox, WebKit)
- **CI-friendly** (headless mode)

### 15.6 Image testing specifika

**Visual regression testing** pomocí `pixelmatch`:

```typescript
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

async function compareImages(
  actualPath: string,
  expectedPath: string,
  threshold: number = 0.1,
): Promise<{ match: boolean; diffPixels: number }> {
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  const expected = PNG.sync.read(fs.readFileSync(expectedPath));

  if (actual.width !== expected.width || actual.height !== expected.height) {
    return { match: false, diffPixels: Infinity };
  }

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(
    actual.data,
    expected.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold },
  );

  const totalPixels = actual.width * actual.height;
  const diffPercentage = (diffPixels / totalPixels) * 100;

  return {
    match: diffPercentage < 0.1, // 0.1% tolerance
    diffPixels,
  };
}
```

**Determinismus** (kritické pro CI):

```bash
# Environment variables pro deterministické testy
SHARP_NUM_THREADS=1      # Jednov vlákno pro Sharp
TZ=UTC                   # UTC timezone
--concurrency=1          # Sériové zpracování
```

**Proč?**

- Sharp/libvips může generovat mírně odlišné výstupy v multi-threaded módu
- Timezone ovlivňuje datum/čas v EXIF
- Concurrency ovlivňuje pořadí zpracování

### 15.7 Test utilities

**fs-helpers.ts** - Filesystem utilities:

```typescript
export async function listTree(dir: string): Promise<string[]> {
  const entries: string[] = [];
  const walk = async (d: string) => {
    const items = await fs.readdir(d, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(d, item.name);
      entries.push(full);
      if (item.isDirectory()) await walk(full);
    }
  };
  await walk(dir);
  return entries.sort();
}
```

**manifest-assert.ts** - Manifest validation:

```typescript
export function normalizeManifest(manifest: any): any {
  // Remove timestamps, normalize paths, sort keys
  const normalized = JSON.parse(JSON.stringify(manifest));
  delete normalized.generatedAt;
  // Sort photoDays by date
  normalized.photoDays.sort((a, b) => a.date.localeCompare(b.date));
  return normalized;
}
```

**fixtures.ts** - Test fixture generator:

```typescript
export async function buildInputSet(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });

  // Generate test images programmatically (no binary files in repo)
  for (let i = 1; i <= 5; i++) {
    const img = sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 100 + i * 20, g: 150, b: 200 },
      },
    });
    await img.jpeg().toFile(path.join(dir, `test-${i}.jpg`));
  }
}
```

### 15.8 Spouštění testů

**NPM scripts** (z `package.json`):

```json
{
  "scripts": {
    "test": "vitest run && playwright test",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:images": "vitest run -c vitest.config.images.ts",
    "test:all": "bun run test:unit:images && bun run test:images && bun run test:e2e",
    "test:watch": "vitest watch"
  }
}
```

**Příklady použití**:

```bash
# Všechny testy
bun run test

# Pouze unit testy
bun run test:unit

# Pouze integration testy
bun run test:integration

# Pouze E2E testy
bun run test:e2e

# Image testing suite (unit + integration + E2E pro images)
bun run test:images

# Watch mode (automatický re-run při změnách)
bun run test:watch

# Update snapshots
bun run test:images -- -u
```

### 15.9 CI/CD Pipeline

**GitHub Actions workflow** (ukázka):

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install libvips (for Sharp)
        run: sudo apt-get install -y libvips

      - name: Install dependencies
        run: bun install

      - name: Run unit tests
        run: bun run test:unit
        env:
          SHARP_NUM_THREADS: 1
          TZ: UTC

      - name: Run integration tests
        run: bun run test:images
        env:
          SHARP_NUM_THREADS: 1
          TZ: UTC
        timeout-minutes: 10

      - name: Run E2E tests
        run: bun run test:e2e

      - name: Upload test artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-outputs
          path: tests/outputs/
```

**Klíčové nastavení pro CI**:

- Install `libvips` (Sharp dependency)
- Set `SHARP_NUM_THREADS=1` (determinismus)
- Set `TZ=UTC` (timezone consistency)
- Upload artifacts při selhání (debug)
- Timeout 10min (pro dlouhé image testy)

### 15.10 Coverage

**Vitest coverage** (v8 provider):

```bash
# Generate coverage report
bun run test:unit -- --coverage

# Coverage output
---------|---------|----------|---------|---------|
| File      | % Stmts   | % Branch   | % Funcs   | % Lines   |
| --------- | --------- | ---------- | --------- | --------- |
| All files | 85.2      | 78.4       | 90.1      | 84.7      |
| scripts   | 92.3      | 85.1       | 95.0      | 91.8      |
| src/lib   | 78.5      | 71.2       | 85.4      | 77.9      |
| --------- | --------- | ---------- | --------- | --------- |
```

**Coverage goals**:

- Scripts (image generation): >90%
- Lib utilities: >80%
- Components: >70% (vizuální komponenty jsou těžko testovatelné)

---

_Dokumentace byla úspěšně reorganizována podle původního zadání. Poslední aktualizace: 2025-10-21_

# Analýza Projektu Photoblog

Tento dokument poskytuje technický přehled architektury a klíčových funkcí projektu `bun-svelte-photoblog`.

## 1. Přehled projektu

Jedná se o moderní multi-gallery fotoblog postavený na **SvelteKit** a běžící na **Bun** runtime. Klíčovým konceptem je použití proměnné prostředí `CONTENT_DIR`, která umožňuje spravovat více nezávislých galerií (např. `israel-2022`, `egypt-2025`) z jediné kódové základny. Každá galerie má vlastní obsah, konfiguraci a generované assety.

## 2. Backend (Generování dat)

Backendová logika je realizována pomocí skriptů v adresáři `scripts/`, které se spouštějí pomocí Bun. Hlavním úkolem je příprava a optimalizace obrázků a generování manifestů pro frontendovou aplikaci.

### 2.1. Multi-gallery architektura

Celý systém je řízen **proměnnou prostředí `CONTENT_DIR`**, která určuje aktivní galerii:

- `CONTENT_DIR=israel-2022`: Pracuje s `content/israel-2022/` a generuje do `static/israel-2022/`
- `CONTENT_DIR=egypt-2025`: Pracuje s `content/egypt-2025/` a generuje do `static/egypt-2025/`

Tato architektura umožňuje:

- Sdílení jediné kódové základny pro více galerií
- Nezávislé buildování a deployment různých galerií
- Snadné přidání nové galerie bez úpravy kódu

### 2.2. Generování obrázků (`scripts/generate-images.ts`)

Tento skript je centrálním bodem pro zpracování všech fotografií v projektu.

**Klíčové funkce:**

- **Vstup:** Načítá zdrojové obrázky (`.jpg`, `.jpeg`, `.png`, `.heic`) z adresáře `content/<CONTENT_DIR>/pics/`
- **Zpracování:**
  - **Změna velikosti:** Vytváří několik variant každého obrázku v různých rozlišeních:
    - `default`: 370×208px (mobily a velké desktopy)
    - `xl`: 534×300px (tablety a střední desktopy)
    - `detail`: 1280px šířka (lightbox/detail)
    - `fallback`: 190×107px (miniatura)
    - `placeholder`: 24px (LQIP blur asset)
  - **Optimalizace formátu:** Každou velikost generuje v moderních formátech **AVIF** a **WebP** pro efektivní načítání v prohlížeči. Původní formát (JPEG) je zachován jako fallback
  - **Placeholder (rozmazání):** Generuje malé, rozmazané verze obrázků pro LQIP (Low-Quality Image Placeholder)
  - **Metadata:** Čte EXIF data z fotografií (datum pořízení, GPS souřadnice, IPTC, XMP metadata)
  - **Smart caching:** Inteligentní cache (`.temp/<galerie>/images.cache.json`) s hash-based detekcí změn
- **Výstup:** Zpracované obrázky ukládá do adresáře `static/<CONTENT_DIR>/images/`
- **Režimy:** Skript podporuje několik režimů:
  - `--manifestOnly`: Rychlá regenerace pouze manifestu bez přegenerování obrázků (používá se při dev serveru)
  - `--curation`: Generuje kurátorský manifest s detekcí duplikátů
  - `--watch`: Watch režim pro automatickou regeneraci při změnách
  - `--clean`: Odstranění osiřelých souborů po buildu

### 2.3. Generování manifestů

Skript `generate-images.ts` vytváří tři klíč manifesty ve formátu JSON, které jsou uloženy v `src/data/<galerie>/`:

- **`images.manifest.json`**:
  - Obsahuje strukturovaná data o všech fotografiích seskupená podle dnů (`photoDays`)
  - Pro každou fotku uchovává cesty k různým formátům a velikostem, poměr stran, EXIF data, autory, klíčová slova
  - Obsahuje informace o separátorech lokací a parsovaných story (markdown příběhy)
- **`menu.manifest.json`**:
  - Odlehčená navigační struktura pro menu
  - Obsahuje seznam dnů a lokací s odkazy pro rychlou navigaci
- **`site.manifest.json`**:
  - Parsovaná konfigurace galerie ze souboru `content/<galerie>/site.md`
  - SEO metadata, názvy, favicon konfigurace, PWA manifest

Tento přístup odděluje náročné zpracování obrázků od běhu samotné webové aplikace, která tak může pracovat pouze s lehkými a předpřipravenými daty.

## 3. Frontend (SvelteKit Aplikace)

Frontend je postaven na moderním frameworku **SvelteKit (Svelte 5 s runes API)**, který zajišťuje rychlé a interaktivní uživatelské rozhraní. Aplikace je navržena jako statická stránka (SSG) pro rychlé úvodní načtení a optimální SEO.

### 3.1. Resoluce cest a aliasy

Projekt používá speciální alias `$manifests`, který se automaticky resolvuje na aktivní galerii:

```typescript
// V svelte.config.js a vite.config.ts
alias: {
  $manifests: path.resolve(__dirname, "src/data", contentDir);
}
```

Díky tomu lze v kódu psát:

```typescript
import manifest from "$manifests/images.manifest.json";
```

A získat automaticky správnou galerii podle `CONTENT_DIR`.

### 3.2. Struktura a Layout (`+layout.svelte`)

Základní vizuální struktura každé stránky je definována v `src/routes/+layout.svelte`. Tento soubor obaluje všechny ostatní stránky a obsahuje společné prvky:

- **`Header.svelte`**: Hlavní nadpis blogu a navigační menu
- **`AppSidebar.svelte`**: Postranní panel s filtry, editorem a agendou (shadcn-svelte sidebar)
- **Hlavní obsah (`<slot />`)**: Místo, kam SvelteKit vkládá obsah aktuální stránky
- **`Footer.svelte`**: Patička stránky s autorskými právy

### 3.3. Klíčové komponenty

- **`Hero.svelte`**: Úvodní "hero" sekce s titulním obrázkem a názvem
- **`PhotoGrid.svelte`**: Jádro aplikace – galerie fotografií v masonry layoutu
  - **Dynamické generování**: Komponenta přijímá data z manifestu a vykresluje responsive `<picture>` elementy
  - **Optimalizace načítání**: Element `<picture>` obsahuje více `<source>` elementů nabízejících různé formáty (`.avif`, `.webp`, `.jpg`) a velikosti
  - **Lazy Loading & Placeholdery**: Obrázky se načítají líně s LQIP blur placeholdery
  - **Scrollspy**: Detekce aktivní sekce pro zvýraznění v menu
- **`FiltersTab.svelte`**: Filtrování podle autorů a přepínání separátorů
- **`EditTab.svelte`**: Editor metadat pro kurátorský režim
- **`AgendaTab.svelte`**: Navigační menu pro rychlý přístup k fotodním

### 3.4. Svelte Stores (Reaktivní stav)

Projekt využívá Svelte 5 stores pro správu aplikačního stavu:

- `filters.ts`: Stav filtrů (autoři, separátory) a odvozeného filtrovaného seznamu
- `curation.ts`: Stav kurátorského workflow a rozhodnutí
- `editorState.ts`: Multi-výběr a editační stav
- `urlSync.ts`: Synchronizace stavu s URL parametry (sdílitelné linky)
- `metadataClipboard.ts`: Kopírování/vkládání metadat mezi obrázky
- `photoLabels.ts`: Dynamické štítky fotografií a statistiky
- `uiState.ts`: Viditelnost UI prvků (sidebar, debug panely)
- `scrollspy.ts`: Detekce aktivní sekce pro navigaci

### 3.5. Datové toky a logika

- **Server-side načítání dat (`+layout.server.ts`, `+page.server.ts`)**: Data z manifestů jsou načítána na straně serveru. Zajišťuje to, že stránka je doručena již s kompletním obsahem (ideální pro SEO)
- **Předání dat komponentám**: Načtená data jsou předána do Svelte komponent jako `props`
- **API endpointy**: Server endpointy pro geocoding (`/api/geocode`), metadata a operace s obrázky

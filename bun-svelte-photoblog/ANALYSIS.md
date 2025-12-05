# Analýza Projektu Photoblog

Tento dokument poskytuje technický přehled architektury a klíčových funkcí projektu `bun-svelte-photoblog`.

## 1. Backend (Generování dat)

Backendová logika je realizována pomocí skriptů v adresáři `scripts/`, které se spouštějí pomocí Bun. Hlavním úkolem je příprava a optimalizace obrázků a generování manifestů pro frontendovou aplikaci.

### 1.1. Generování obrázků (`scripts/generate-images.ts`)

Tento skript je centrálním bodem pro zpracování všech fotografií v projektu.

**Klíčové funkce:**

- **Vstup:** Načítá zdrojové obrázky (primárně `.jpg`, `.jpeg`) z adresáře `content/israel-2022/`.
- **Zpracování:**
  - **Změna velikosti:** Vytváří několik variant každého obrázku v různých rozlišeních (např. `previews`, `previews-xl`, `previews-xxs`).
  - **Optimalizace formátu:** Každou velikost generuje v moderních formátech **AVIF** a **WebP** pro efektivní načítání v prohlížeči. Původní formát (např. JPEG) je zachován jako fallback.
  - **Placeholder (rozmazání):** Generuje malé, rozmazané verze obrázků (`blurs`), které se zobrazují jako dočasný placeholder, než se načte plná verze.
  - **Metadata:** Čte EXIF data z fotografií (datum pořízení, GPS souřadnice atd.).
- **Výstup:** Zpracované obrázky ukládá do adresáře `static/images/israel-2022/`.
- **Spouštění:** Skripty v `package.json` (`images:build`, `images:watch`) umožňují jednorázové nebo kontinuální (při změně) generování.

### 1.2. Generování manifestů

Skript `generate-images.ts` také vytváří dva klíčové JSON soubory (manifesty), které slouží jako databáze pro Svelte aplikaci.

- **`src/lib/images.manifest.json`**:
  - Obsahuje strukturovaná data o všech fotografiích, seskupená podle dnů.
  - Pro každou fotku uchovává cesty k různým formátům a velikostem, poměr stran, EXIF data a případný popis z přidružených `.md` souborů.
- **`src/lib/menu.manifest.json`**:
  - Generuje zjednodušenou strukturu dat pro navigační menu.
  - Obsahuje seznam dnů a galerií pro rychlé vykreslení odkazů v menu.

Tento přístup odděluje náročné zpracování obrázků od běhu samotné webové aplikace, která tak může pracovat pouze s lehkými a předpřipravenými daty.

## 2. Frontend (SvelteKit Aplikace)

Frontend je postaven na moderním frameworku SvelteKit, který zajišťuje rychlé a interaktivní uživatelské rozhraní. Aplikace je navržena s využitím server-side renderingu (SSR) pro rychlé úvodní načtení a dobrou SEO optimalizaci.

### 2.1. Struktura a Layout (`+layout.svelte`)

Základní vizuální struktura každé stránky je definována v `src/routes/+layout.svelte`. Tento soubor obaluje všechny ostatní stránky a obsahuje společné prvky:

- **`Header.svelte`**: Zobrazuje hlavní nadpis blogu a navigační menu. Menu je dynamicky generováno na základě souboru `menu.manifest.json`, což umožňuje snadné přidávání nových galerií bez nutnosti měnit kód komponenty.
- **Hlavní obsah (`<slot />`)**: Místo, kam SvelteKit vkládá obsah aktuální stránky (např. úvodní "hero" sekci nebo mřížku s fotkami).
- **`Footer.svelte`**: Zobrazuje patičku stránky s informacemi o autorských právech a použitých technologiích.

### 2.2. Klíčové komponenty

- **`Hero.svelte`**: Komponenta pro zobrazení úvodní "hrdinské" sekce na hlavní stránce, typicky s velkým obrázkem nebo videem a krátkým textem.
- **`PhotoGrid.svelte`**: Jádro aplikace, které efektivně vykresluje fotografie.
  - **Dynamické generování**: Komponenta přijímá data o fotografiích (načtená v `+page.server.ts`) a pro každou z nich vytváří HTML element `<picture>`.
  - **Optimalizace načítání**: Element `<picture>` je klíčový pro výkon. Obsahuje více `<source>` elementů, které nabízejí prohlížeči stejný obrázek v různých formátech (`.avif`, `.webp`) a velikostech. Prohlížeč si sám vybere nejlepší variantu, kterou podporuje, což dramaticky snižuje objem přenášených dat a zrychluje načítání.
  - **Lazy Loading & Placeholdery**: Obrázky se načítají líně (až když se přiblíží k viditelné části obrazovky) a během načítání se zobrazuje malý, rozmazaný placeholder (`blur`), což zlepšuje vnímanou rychlost stránky.

### 2.3. Datové toky a logika

- **Server-side načítání dat (`+layout.server.ts`, `+page.server.ts`)**: Data z vygenerovaných `.json` manifestů jsou načítána na straně serveru. Tím se zajišťuje, že stránka je klientovi doručena již s kompletním obsahem, což je ideální pro SEO a rychlost prvního zobrazení.
- **Předání dat komponentám**: Načtená data jsou předána do Svelte komponent (`+layout.svelte`, `+page.svelte`) jako `props`, kde jsou následně použita pro vykreslení uživatelského rozhraní.
- **Detekce mobilních zařízení (`is-mobile.svelte.ts`)**: Projekt využívá Svelte 5 Runes (`$state`) k vytvoření reaktivního hooku, který v reálném čase sleduje, zda je stránka zobrazena na mobilním zařízení. To umožňuje dynamicky upravovat layout nebo chování komponent podle velikosti obrazovky.

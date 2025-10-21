# Fotoblog Israel 2022 (SvelteKit & Bun)

Tento projekt je moderní implementací fotoblogu, postavenou na **SvelteKit** a poháněnou **Bun** jakožto JavaScript runtime i balíčkovacím manažerem. Využívá **Vite** pro build proces a **Tailwind CSS** pro stylování.

Jádrem projektu je pokročilý skript pro **generování a optimalizaci obrázků**, který automatizuje přípravu různých formátů a velikostí pro web, včetně LQIP (Low-Quality Image Placeholders) a dominantních barev pro plynulé načítání.

## Klíčové technologie

- **Framework**: [SvelteKit](https://kit.svelte.dev/)
- **Runtime a bundler**: [Bun](https://bun.sh/)
- **Build nástroj**: [Vite](https://vitejs.dev/)
- **Stylování**: [Tailwind CSS](https://tailwindcss.com/)
- **Generování obrázků**: [Sharp](https://sharp.pixelplumbing.com/) (vlastní skript)
- **Testování**: [Vitest](https://vitest.dev/) (unit & integration), [Playwright](https://playwright.dev/) (E2E)
- **Linting a formátování**: [Biome](https://biomejs.dev/), [Prettier](https://prettier.io/), [Stylelint](https://stylelint.io/)

## Instalace

1.  **Přejděte do složky projektu:**
    ```bash
    cd bun-svelte-photoblog
    ```
2.  **Nainstalujte závislosti:**
    ```bash
    bun install
    ```
3.  **Nainstalujte systémové knihovny pro Sharp (libvips):**
    - **macOS:** `brew install vips`
    - **Debian/Ubuntu:** `sudo apt-get update && sudo apt-get install -y libvips`

## Dostupné skripty

Následující skripty jsou definovány v `package.json` a spouští se pomocí `bun run <nazev_skriptu>`:

- `dev`: Spustí vývojový server s hot-reloadingem.
- `build`: Sestaví produkční verzi aplikace (včetně generování obrázků díky `prebuild` kroku).
- `preview`: Spustí lokální server pro náhled produkční verze.
- `test`: Spustí všechny unit, integrační a E2E testy.
- `test:unit`: Spustí unit testy pomocí Vitest.
- `test:e2e`: Spustí end-to-end testy pomocí Playwright.
- `lint`: Zkontroluje kód pomocí Biome a Stylelint.
- `format`: Automaticky zformátuje kód pomocí Biome a Prettier.

## Generování obrázků

Skript `scripts/generate-images.ts` je centrálním nástrojem pro zpracování fotografií.

### Klíčové vlastnosti

- **Více variant obrázků**: `details`, `previews`, `previews-xl`, `previews-xxs`.
- **Moderní formáty**: AVIF, WebP, JPEG s nastavitelnou kvalitou.
- **Manifest**: Generuje `images.manifest.json` s metadaty a cestami pro snadné použití v aplikaci.
- **LQIP a dominantní barva**: Pro plynulé načítání a vizuální stabilitu.
- **Blur assety**: Volitelné generování rozmazaných placeholderů.
- **Optimalizace**: Watch mód, cache, čištění osiřelých souborů, paralelizace.

### Skripty pro obrázky

- `images:build`: Vygeneruje standardní sady obrázků.
- `images:watch`: Sleduje zdrojovou složku a automaticky regeneruje obrázky při změně.
- `images:blur`: Vygeneruje pouze rozmazané "blur" assety.
- `images:all`: Spustí `images:build` a následně `images:blur`.

### Základní použití (CLI)

Skript lze spouštět i přímo s vlastními parametry. Cesty ke zdrojovým a cílovým složkám je třeba upravit, protože obsah je v nadřazeném adresáři.

- **Build běžných obrázků:**
  ```bash
  bun scripts/generate-images.ts --src=../content/israel-2022 --out=./static/images/israel-2022 --manifest=./src/lib/images.manifest.json
  ```
- **Watch mód:**
  ```bash
  bun scripts/generate-images.ts --src=../content/israel-2022 --watch=true
  ```
- **Čištění osiřelých souborů:**
  ```bash
  bun scripts/generate-images.ts --src=../content/israel-2022 --clean=true
  ```

### CLI parametry

Kompletní seznam parametrů je k dispozici v horní části souboru `scripts/generate-images.ts`. Níže jsou uvedeny ty nejdůležitější.

#### Běžné generování

- `--src`: Cesta ke zdrojovým obrázkům.
- `--out`: Cílová složka pro vygenerované obrázky.
- `--manifest`: Cesta k výstupnímu manifestu.
- `--variants`: Seznam variant k generování (např. `details,previews`).
- `--formats`: Seznam formátů (např. `avif,webp,jpeg`).
- `--quality.*`: Nastavení kvality pro jednotlivé formáty (např. `--quality.avif=50`).
- `--watch`: Zapnutí watch módu.
- `--clean`: Odstranění osiřelých souborů po buildu.
- `--limit`: Omezí počet zpracovaných obrázků (užitečné pro testování).

#### Generování "blur" assetů

- `--blur.enable=true`: Zapnutí generování blur assetů.
- `--blur.only=true`: Spustí pouze generování blur assetů.
- `--blur.src`: Zdrojová složka pro blur (typicky varianta `previews-xl`).
- `--blur.out`: Cílová složka pro blur assety.
- `--blur.width`: Cílová šířka (výchozí: 24px).
- `--blur.colors`: Počet barev pro PNG paletu.

## Struktura projektu

- `src/`: Zdrojový kód aplikace SvelteKit.
  - `lib/`: Sdílené komponenty, utility a runtime kód pro obrázky.
  - `routes/`: Struktura stránek a API endpointů.
- `content/`: Zdrojový obsah (Markdown soubory, originální fotografie).
- `static/`: Statické soubory, včetně vygenerovaných obrázků.
- `scripts/`: Pomocné skripty (včetně `generate-images.ts`).
- `tests/`: Unit, integrační a E2E testy.

- Pouze blur s výchozími hodnotami (parita s legacy):
  - bun run images:blur
- Blur z vlastního vstupu i cíle:
  - bun scripts/generate-images.ts --blur.enable=true --blur.only=true --blur.src=../static/assets/israel-2022/previews-xl --blur.out=../static/assets/israel-2022/blurs --blur.width=24 --blur.colors=32 --blur.formats=png

Poznámky k paritě s [gen-blured-images.sh](gen-blured-images.sh:1)

- Legacy používal ImageMagick convert s -resize 24x, -define png:format=png8, -colors 32, -quality 50, -filter Lanczos. Ekvivalent v Sharp:
  - PNG: png({ palette:true, colors:N, quality:Q, compressionLevel })
  - Resample: výchozí Lanczos3 ~ -filter Lanczos
  - AVIF/JPEG: kvalita řízena vlastními přepínači
- Názvová konvence: zachováváme název vstupu, mění se přípona dle formátu (např. foto.jpg → foto.png v cíli)

Výkon a cache

- Paralelizace řízena --concurrency nebo auto
- Cache běžného buildu: .images-cache.json (rychlé přeskočení nezměněných)
- Blur fáze je samostatná a neukládá manifest; je určena pro legacy assety

Chování při chybách

- Chyby se logují a běh vrací nenulový kód, pokud k nim dojde
- Při absenci Sharp/libvips lze hlavní build provozovat s --fallback=copy (bez transformací). Blur fáze bez Sharp nedává smysl.

Minimální akceptační scénáře

- A) bun run images:build → vzniknou varianty a manifest, bez chyb
- B) bun run images:blur → vzniknou blur soubory v ../static/assets/israel-2022/blurs
- C) bun run images:all → obě fáze sekvenčně, bez chyb

Známá omezení

- Výchozí --src v kódu míří do content/israel-2022 relativně k aktuálnímu adresáři. Pokud běžíte z této složky a data jsou v nadřazeném repu, použijte --src=../content/israel-2022.
- Blur intenzita pro UI (placeholder='blur') je řízena CSS ve [Picture.svelte](bun-svelte-photoblog/src/lib/components/Picture.svelte:108) (filter: blur(20px)); nejde o asset-level parametr.

Licenční a poznámky

- Tento subprojekt je součástí nadřazeného repozitáře; viz kořenový [README](README.md:1) a licence.

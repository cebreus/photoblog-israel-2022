# Fotoblog | Bun + SvelteKit (Multi-gallery)

Tento projekt je moderní fotoblog postavený na SvelteKit a optimalizovaný pro rychlost pomocí Bun. Projekt byl rozšířen, aby podporoval **správu více galerií** z jediné kódové základny, kde každá galerie má vlastní obsah, konfiguraci a sadu generovaných souborů.

## Klíčový koncept: Kontext galerie (`CONTENT_DIR`)

Celý systém je řízen pomocí **proměnné prostředí `CONTENT_DIR`**. Tato proměnná určuje, která galerie (tj. který podadresář v `content/`) je aktivní pro vývoj, sestavení nebo generování souborů.

Například `CONTENT_DIR=israel-2022` řekne všem skriptům, aby pracovaly s daty v `content/israel-2022/` a generovaly soubory do `static/israel-2022/`.

## Architektura a struktura projektu

Projekt je rozdělen na tři hlavní vrstvy:

1.  **Obsah (`content/<nazev-galerie>`)**:
    - Obsahuje zdrojové soubory pro každou galerii.
    - `pics/`: Zdrojové fotografie ve vysokém rozlišení.
    - `site.md`: Hlavní konfigurační soubor pro danou galerii (názvy, popisky, nastavení pro generování favicon a PWA manifestu).
    - `favicons-source.png`: Zdrojový obrázek pro generování favicon.

2.  **Veřejné soubory (`static/<nazev-galerie>`)**:
    - Obsahuje veřejně přístupné, vygenerované soubory.
    - Adresářová struktura zde zrcadlí strukturu v `content/`.
    - `images/`: Optimalizované varianty obrázků (AVIF, WebP, JPEG).
    - `assets/favicons/`: Vygenerované favikony a manifesty.

3.  **Aplikace (`src/`)**:
    - Samotná SvelteKit aplikace, která je pro všechny galerie stejná.
    - Načítá data (`images.manifest.json`, `menu.manifest.json`) vygenerovaná do `src/lib/` a na jejich základě dynamicky sestavuje stránky.

### Author slugs & shareable filters

The app treats author filter values as canonical slugs for URL sharing and state. The build step produces `authorSlug` on each image entry inside `src/lib/images.manifest.json` and separator items may contain `storyHtml` (pre-rendered HTML of markdown stories). The client mapping accepts legacy display names for backward compatibility but will write and prefer slug values in the `authors=` CSV parameter in the URL. This makes filter links smaller and stable for sharing.

## Instalace

1.  Ujistěte se, že máte nainstalovaný [Bun](https://bun.sh/).
2.  Nainstalujte systémové knihovny pro `sharp` (vyžaduje `libvips`):
    - **macOS:** `brew install vips`
    - **Debian/Ubuntu:** `sudo apt-get update && sudo apt-get install -y libvips`
3.  Nainstalujte závislosti projektu:
    ```bash
    bun install
    ```

## Použití a skripty v `package.json`

Všechny klíčové akce se nyní spouštějí pomocí skriptů, které interně pracují s proměnnou `CONTENT_DIR`.

### Vývoj

- **Spuštění vývojového serveru pro konkrétní galerii:**

  ```bash
  # Spustí dev server pro galerii 'israel-2022'
  bun run dev:israel

  # Spustí dev server pro galerii 'egypt-2025'
  bun run dev:egypt
  ```

  > **Poznámka:** Dev příkazy používají flag `--manifestOnly` pro skript `images:build`. To znamená, že při startu se pouze rychle přepočítá manifest, ale negenerují se znovu všechny obrázky (pokud už existují). To výrazně zrychluje start serveru. Pro plné přegenerování použijte `bun run images:build`.

- Obecný příkaz `bun run dev` je aliasem pro `bun run dev:israel`.

### Sestavení pro produkci (Build)

- **Sestavení konkrétní galerie do odděleného adresáře:**

  ```bash
  # Sestaví web pro 'israel-2022' do adresáře 'build-israel-2022/'
  bun run build:israel

  # Sestaví web pro 'egypt-2025' do adresáře 'build-egypt-2025/'
  bun run build:egypt
  ```

- Obecný příkaz `bun run build` sestaví výchozí galerii (`israel-2022`) do standardního adresáře `build/`.

### Ruční generování assetů

Tyto příkazy jsou užitečné pro jednorázovou aktualizaci souborů bez spouštění serveru. Jsou řízeny proměnnou `CONTENT_DIR`.

- `bun run generate`: Spustí generování obrázků i favicon pro výchozí galerii (`israel-2022`).
- `bun run images:build`: Spustí pouze generování obrázků.
- `bun run favicons:build`: Spustí pouze generování favicon.

**Příklad s kontextem:**

```bash
# Vygeneruje obrázky pouze pro galerii 'egypt-2025'
CONTENT_DIR=egypt-2025 bun run images:build
```

## Jak přidat novou galerii

1.  Vytvořte nový adresář v `content/`, např. `content/nova-galerie`.
2.  Do tohoto adresáře přidejte zdrojové fotky a konfigurační soubor `site.md` (můžete zkopírovat a upravit existující).
3.  Do `package.json` přidejte nové skripty pro vývoj a build po vzoru `dev:israel` a `build:israel`:
    ```json
    "scripts": {
      ...
      "dev:nova-galerie": "CONTENT_DIR=nova-galerie bun run images:build -- --clean && CONTENT_DIR=nova-galerie bun run favicons:build && vite dev",
      "build:nova-galerie": "CONTENT_DIR=nova-galerie OUTPUT_DIR=build-nova-galerie bun run build",
      ...
    }
    ```
4.  Spusťte vývojový server pro vaši novou galerii:
    ```bash
    bun run dev:nova-galerie
    ```

## Testování a QA

Projekt využívá komplexní testovací strategii zahrnující unit testy pro logiku, component testy pro UI (Vitest Browser Mode) a E2E testy (Playwright).

Podrobné informace o tom, jak psát a spouštět testy, najdete v dokumentaci:
👉 **[TESTING.md](./TESTING.md)**

Stručně:

- **Unit testy:** `bun run test:unit`
- **Component testy:** `CONTENT_DIR=egypt-2025 bun run vitest run --project client`
- **Všechny testy:** `bun run test`

# Fotoblog | Multi-gallery SvelteKit

Moderní fotoblog s podporou více galerií z jediné kódové základny. Postaveno na SvelteKit, Bun a Svelte 5.

## Klíčový koncept: Multi-gallery s `CONTENT_DIR`

Celý systém je řízen pomocí **proměnné prostředí `CONTENT_DIR`**, která určuje aktivní galerii pro vývoj, build nebo generování assetů.

```bash
# Příklad: práce s galerií Egypt 2025
CONTENT_DIR=egypt-2025 bun run images:build

# Příklad: práce s galerií Israel 2022
CONTENT_DIR=israel-2022 bun run dev
```

Každá galerie má:

- Vlastní obsah v `content/<název-galerie>/`
- Vlastní vygenerované assety ve `static/<název-galerie>/`
- Vlastní manifesty v `src/data/<název-galerie>/`

## Quick Start

### Instalace

1. Ujistěte se, že máte nainstalovaný [Bun](https://bun.sh/)
2. Nainstalujte systémové knihovny pro Sharp (vyžaduje libvips):
   - **macOS:** `brew install vips`
   - **Debian/Ubuntu:** `sudo apt-get install -y libvips`
3. Nainstalujte závislosti projektu:
   ```bash
   bun install
   ```

### Vývoj

Spuštění vývojového serveru pro konkrétní galerii:

```bash
bun run dev:egypt    # Galerie Egypt 2025
bun run dev:israel   # Galerie Israel 2022
```

Výchozí příkaz `bun run dev` je alias pro `dev:egypt`.

### Build

Sestavení konkrétní galerie do odděleného adresáře:

```bash
bun run build:egypt    # Sestaví do build-egypt-2025/
bun run build:israel   # Sestaví do build-israel-2022/
```

### Testování

```bash
bun run test                                           # Všechny testy
bun run test:unit                                      # Unit testy
CONTENT_DIR=egypt-2025 bun run vitest run --project client  # Component testy
```

## Dokumentace

- **[Architektura projektu](./docs/ARCHITECTURE.md)** - Detailní popis struktury, datových toků a 3vrstvé architektury
- **[Přehled projektu](./docs/ANALYSIS.md)** - Technický přehled klíčových funkcí
- **[Kompletní seznam skriptů](./docs/SCRIPTS.md)** - Všechny dostupné Bun skripty s příklady použití
- **[Přidání nové galerie](./docs/ADD-GALLERY.md)** - Návod krok za krokem
- **[Testování](./docs/TESTING.md)** - Testing strategie a best practices
- **[Testování image processing](./docs/TESTING-IMAGES.md)** - Testování generování obrázků

## Technologie

- **Runtime:** Bun (JavaScript runtime + package manager)
- **Framework:** SvelteKit 2 + Svelte 5 (runes API)
- **Styling:** Tailwind CSS v4
- **Image Processing:** Sharp (vyžaduje libvips)
- **Testing:** Vitest (unit/component) + Playwright (E2E)
- **Linting:** Biome, Prettier, Stylelint

## Licence

Tento projekt je soukromý.

# Přidání nové galerie

Tento návod popisuje krok za krokem, jak přidat novou galerii do projektu.

**Navigace:** [← INDEX](./INDEX.md) | [ARCH-STRUCTURE →](./ARCH-STRUCTURE.md) | [SCRIPTS →](./SCRIPTS.md)

## Přehled

Díky multi-gallery architektuře s proměnnou `CONTENT_DIR` můžete snadno přidat novou galerii bez úpravy kódu aplikace. Každá galerie má:

- Vlastní obsah v `content/<název-galerie>/`
- Vlastní vygenerované assety ve `static/<název-galerie>/`
- Vlastní manifesty v `src/data/<název-galerie>/`
- Vlastní skripty v `package.json`

## Krok 1: Vytvoření adresářové struktury

Vytvořte nový adresář pro vaši galerii v `content/`:

```bash
mkdir -p content/nova-galerie/pics
```

**Výsledná struktura:**

```
content/
└── nova-galerie/
    ├── pics/                # Sem přidáte zdrojové fotografie
    ├── site.md              # Konfigurace galerie (viz krok 2)
    └── favicons-source.png  # Zdrojový obrázek pro favicon (volitelné)
```

## Krok 2: Konfigurace galerie (`site.md`)

Vytvořte konfigurační soubor `content/nova-galerie/site.md` s následujícím obsahem:

```markdown
---
title: Název vaší galerie
description: Popis galerie pro SEO
ogTitle: Název pro Open Graph (sociální sítě)
ogDescription: Popis pro Open Graph
faviconEmoji: 🌍
locale: cs-CZ
---

# Název galerie

Hlavní popis nebo úvodní text galerie.
```

### Význam jednotlivých polí:

- **title**: Název galerie (zobrazuje se v hlavičce a `<title>`)
- **description**: Krátký popis pro SEO meta tag
- **ogTitle**: Název pro Open Graph (Facebook, Twitter)
- **ogDescription**: Popis pro Open Graph
- **faviconEmoji**: Emoji použité pro generování favicon (alternativa k `favicons-source.png`)
- **locale**: Jazyk a lokalita (např. `cs-CZ`, `en-US`)

### Příklad kompletní konfigurace:

```markdown
---
title: Cesta Španělskem 2024
description: Fotoblog z měsíčního roadtripu po Španělsku - od Barcelony po Andalusii
ogTitle: Španělsko 2024 | Fotoblog
ogDescription: Více než 500 fotografií z cesty po Pyrenejském poloostrově
faviconEmoji: 🇪🇸
locale: cs-CZ
author: Jan Novák
keywords:
  - španělsko
  - roadtrip
  - fotografie
  - andalusie
  - barcelona
---

# Cesta Španělskem 2024

V březnu 2024 jsme vyrazili na měsíční roadtrip po Španělsku. Navštívili jsme Barcelona, Valencia, Granada, Sevilla a mnoho dalších měst.
```

> **Tip:** Zkopírujte a upravte existující `site.md` z jiné galerie jako šablonu.

## Krok 3: Přidání fotografií

Zkopírujte vaše zdrojové fotografie (ve vysokém rozlišení) do `content/nova-galerie/pics/`:

```bash
cp ~/Photos/spanelsko/*.jpg content/nova-galerie/pics/
```

**Podporované formáty:**

- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- HEIC (`.heic`)

**Organizace fotografií:**

Můžete vytvořit podadresáře podle dnů nebo lokací:

```
content/nova-galerie/pics/
├── 2024-03-01/
│   ├── IMG_0001.jpg
│   └── IMG_0002.jpg
├── 2024-03-02/
│   └── IMG_0003.jpg
└── barcelona/
    ├── IMG_0010.jpg
    └── IMG_0011.jpg
```

Nebo vložit všechny fotografie na jednu hromadu - generátor je automaticky seskupí podle EXIF data pořízení.

## Krok 4: Spuštění (pomocí CLI)

Díky novému CLI (`scripts/manage.ts`) **nemusíte** přidávat žádné skripty do `package.json`. Stačí použít interaktivní režim nebo flagy.

### Interaktivní režim

Spusťte jakýkoli příkaz (`dev`, `build`, `process`) a vyberte galerii ze seznamu:

```bash
bun run dev
# -> Select a gallery to process:
#    ● nova-galerie
```

### Pomocí přepínače `-g`

```bash
bun run dev -- -g nova-galerie
bun run build -- -g nova-galerie
bun run process -- -g nova-galerie
```

### Volitelné: Přidání aliasů do `package.json`

Pokud chcete mít zkratku jako `bun run dev:spanelsko`, můžete přidat skripty do `package.json`. To je ale čistě volitelné.

```json
{
  "scripts": {
    "dev:spanelsko": "bun run dev -- -g nova-galerie",
    "build:spanelsko": "bun run build -- -g nova-galerie"
  }
}
```

## Krok 5: První generování assetů

Vygenerujte optimalizované obrázky a favicons:

```bash
# Interaktivně
bun run process

# Nebo přímo
bun run process -- -g nova-galerie
```

Tento proces může trvat několik minut v závislosti na počtu fotografií.

**Co se vytvoří:**

- `static/nova-galerie/images/` - Optimalizované obrázky (AVIF, WebP, JPEG)
- `static/nova-galerie/assets/favicons/` - Favicon v různých velikostech
- `src/data/nova-galerie/images.manifest.json` - Hlavní manifest fotografií
- `src/data/nova-galerie/menu.manifest.json` - Navigační menu
- `src/data/nova-galerie/site.manifest.json` - Konfigurace galerie
- `.temp/nova-galerie/images.cache.json` - Cache pro rychlejší přegenerování

## Krok 6: Spuštění vývojového serveru

Spusťte dev server pro novou galerii:

```bash
bun run dev -- -g nova-galerie
```

nebo pomocí obecného příkazu:

```bash
CONTENT_DIR=nova-galerie bun run dev
```

Otevřete prohlížeč na `http://localhost:5173` a měli byste vidět vaši novou galerii!

## Krok 7: Production build

Když jste spokojeni s výsledkem, vytvořte production build:

```bash
bun run build -- -g nova-galerie
```

Výsledek bude v adresáři `build-nova-galerie/`, který můžete nasadit na libovolný statický hosting (Netlify, Vercel, GitHub Pages, atd.).

## Volitelné kroky

### Vlastní favicon (místo emoji)

Pokud chcete použít vlastní favicon místo emoji, vytvořte soubor `content/nova-galerie/favicons-source.png`:

- **Rozlišení:** 512×512px nebo větší (čtvercový)
- **Formát:** PNG s průhledným pozadím
- **Obsah:** Jednoduchý motiv, který funguje i v malých velikostech

Pak odstraňte `faviconEmoji` z `site.md`.

### Přidání story (příběhů)

Kromě fotografií můžete přidat textové příběhy k jednotlivým dnům nebo lokacím. Vytvořte markdown soubory v `content/nova-galerie/pics/`:

```markdown
<!-- content/nova-galerie/pics/2024-03-01/story.md -->

# Barcelona - Den první

Přistáli jsme v Barceloně a první zastávka byla samozřejmě Sagrada Família...
```

Tyto příběhy budou automaticky zparsovány a zobrazeny v galerii jako separátory lokací.

### EXIF metadata

Generátor automaticky extrahuje metadata z fotografií:

- Datum a čas pořízení (Wall Clock)
- GPS souřadnice
- Název místa (z IPTC/XMP)
- Autora (z IPTC)
- Klíčová slova

Ujistěte se, že vaše fotografie mají správná EXIF data, nebo je doplňte pomocí editoru metadat (např. Adobe Lightroom, exiftool).

### Testování

Po vytvoření nové galerie spusťte testy:

```bash
CONTENT_DIR=nova-galerie bun run test
```

## Troubleshooting

### Chyba: "CONTENT_DIR not set"

Ujistěte se, že explicitně nastavujete `CONTENT_DIR` pro všechny příkazy:

```bash
CONTENT_DIR=nova-galerie bun run images:build
```

### Chyba: "libvips not found"

Nainstalujte systémovou knihovnu Sharp:

- **macOS:** `brew install vips`
- **Debian/Ubuntu:** `sudo apt-get install -y libvips`

### Obrázky se negenerují

- Zkontrolujte, že fotografie jsou v podporovaném formátu (JPEG, PNG, HEIC)
- Zkontrolujte oprávnění k souborům
- Smažte cache: `rm -rf .temp/nova-galerie/`

### Build je pomalý

- Při vývoji používejte `--manifestOnly` flag
- Omezení počtu fotek: `bun run images:build --limit=10`
- Nastavte paralelní zpracování: `bun run images:build --concurrency=8`

## Shrnutí Checklist

- [ ] Vytvořit `content/nova-galerie/pics/`
- [ ] Vytvořit `content/nova-galerie/site.md`
- [ ] Zkopírovat fotografie do `pics/`
- [ ] Spustit `pnpm process -- -g nova-galerie`
- [ ] Spustit `pnpm dev -- -g nova-galerie`
- [ ] Ověřit galerii v prohlížeči
- [ ] Production build: `pnpm build -- -g nova-galerie`

## Související dokumenty

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Hlavní přehled architektury
- [SCRIPTS.md](./SCRIPTS.md) — CLI příkazy
- [ARCH-STRUCTURE.md](./ARCH-STRUCTURE.md) — Struktura projektu
- [ARCH-BUILD.md](./ARCH-BUILD.md) — Build proces

---

_Poslední aktualizace: 2026-01-05_

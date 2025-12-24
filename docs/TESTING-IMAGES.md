# Testování generování obrázků a blur assetů (Bun + SvelteKit)

Tento dokument popisuje strategii a implementaci testování pro skript `generate-images.ts` a související pipeline pro zpracování obrázků.

## Cíl testování

Zajistit spolehlivost CLI generátoru obrázků (`scripts/generate-images.ts`) pro **multi-gallery architekturu** včetně:

- **Hlavních přepínačů**: `--manifestOnly`, `--curation`, `--watch`, `--clean`, `--limit`, `--concurrency`
- **Multi-gallery podpory**: Testování s různými hodnotami `CONTENT_DIR`
- **Blur pipeline**: Generování LQIP (Low-Quality Image Placeholders) a blur assetů
- **Integrity dat**: Kontrola vygenerovaných manifestů (`images.manifest.json`, `menu.manifest.json`, `site.manifest.json`) a struktury adresářů
- **Determinismu**: Zajištění konzistentních výstupů pro cache a snapshot testy
- **Hash-based caching**: Ověření že se obrázky negenerují znovu pokud se nezměnily

## Strategie testování

Testy jsou rozděleny do tří úrovní a běží v prostředí **Bun** (pro unit/integration) a **Playwright** (pro E2E).

1.  **Jednotkové testy (Unit Tests)**:
    - Testují izolované funkce (parsování argumentů, normalizace cest, logika manifestu)
    - Rychlé, bez I/O operací (pokud možno)
    - Umístění: `tests/unit/`

2.  **Integrační testy (Integration Tests)**:
    - Testují celé CLI volání v kontrolovaném prostředí
    - Používají programově generované fixtury (obrázky)
    - Ověřují výstupní soubory a obsah JSON manifestů proti snapshotům
    - Testují různé `CONTENT_DIR` hodnoty pro multi-gallery podporu
    - Umístění: `tests/integration/`

3.  **End-to-End testy (E2E Tests)**:
    - Testují vizuální stránku komponent v prohlížeči pomocí Playwright
    - Umístění: `e2e/`

## Adresářová struktura testů

```
bun-svelte-photoblog/
  tests/
    fixtures/               # Logic pro generování vstupních dat (programově)

    unit/
      images-cli.unit.spec.ts      # Testy CLI parseru a defaults
      manifest-builder.unit.spec.ts # Testy struktury manifestu
      filter-utils.unit.spec.ts     # Testy filtrování
      ...

    integration/
      generate-and-blur.int.spec.ts # Hlavní integrační test (Image Gen + Blur)

    utils/
      fs-helpers.ts         # Pomocné funkce pro práci s FS
      image-assert.ts       # Porovnávání obrázků (pixelmatch)
      manifest-assert.ts    # Normalizace manifestu pro snapshoty
      process-helpers.ts    # Spouštění CLI procesů
      fixtures.ts           # Generování testovacích obrázků (Sharp)
```

## Konfigurace a spouštění

### Vitest konfigurace

Testy pro obrázky používají specializovanou konfiguraci **`vitest.config.images.ts`**, která:

- Nastavuje prostředí `node` (Bun runtime)
- Definuje delší timeouty pro operace s obrázky (60s pro testy, 30s pro hooks)
- Určuje **sériové spouštění** pro integrační testy (prevence race conditions u souborů)
- Poskytuje globální `$lib` alias pro importy v testech

### Skripty v `package.json`

```bash
# Spustí pouze unit testy pro obrázky a CLI
bun run test:unit:images

# Spustí integrační a E2E testy pro image pipeline
# (s SHARP_NUM_THREADS=1 pro deterministické výstupy)
bun run test:images

# Spustí všechny testy (unit + component + integration + E2E)
bun run test
```

> **Poznámka:** Skript `test:images` nastavuje `SHARP_NUM_THREADS=1` pro zajištění deterministických výstupů při kompresi obrázků, což je klíčové pro snapshot testy a stabilitu na CI.

## Implementované testy

### `generate-and-blur.int.spec.ts`

Tento soubor obsahuje klíčové integrační scénáře pro multi-gallery architekturu:

1.  **Main Images Generation**:
    - Spustí CLI s plnou sadou parametrů a různými `CONTENT_DIR` hodnotami
    - Vygeneruje vstupní sadu obrázků (JPEG, PNG, HEIC)
    - Ověří, že vznikly všechny tři manifesty (`images.manifest.json`, `menu.manifest.json`, `site.manifest.json`)
    - Porovná normalizovaný manifest se snapshotem
    - Ověří strukturu výstupních adresářů (`static/<CONTENT_DIR>/images/`)

2.  **Manifest-Only Regeneration**:
    - Testuje `--manifestOnly` flag pro rychlou regeneraci bez přegenerování obrázků
    - Ověřuje, že existující obrázky nejsou přegenerovány

3.  **Curation Manifest**:
    - Testuje `--curation` flag pro generování kurátorského manifestu
    - Ověřuje detekci duplikátů a podobnosti mezi obrázky

4.  **Blur Assets**:
    - Testuje generování malých LQIP placeholders (24px blur)
    - Ověřuje rozměry a formát (AVIF/WebP/JPEG)

5.  **Clean Mode**:
    - Testuje `--clean` flag, který odstraní osiřelé soubory z předchozích buildů

### `images-cli.unit.spec.ts`

Testuje logiku parsování CLI argumentů v `scripts/lib/core/cli-parser.ts`:

- Ověřuje výchozí hodnoty
- Testuje prioritizaci flagů (CLI args > config defaults)
- Validuje nepovolené kombinace
- Testuje detekci `--manifestOnly`, `--curation`, `--watch`, `--clean` a dalších speciálních flagů

### `manifest-builder.unit.spec.ts`

Testuje funkce `buildGeneratorManifest`, `buildMenuManifest` a `buildSiteManifest`:

- Zajišťuje, že struktura všech tří JSON manifestů odpovídá očekávání frontendu
- Testuje výpočty rozměrů a hashování
- Ověřuje správné parsování `site.md` konfigurace
- Testuje generování menu struktury z photo days

## Pomocné utility

- **`fixtures.ts`**: Místo ukládání binárních obrázků do gitu si testy generují vstupy (JPEG, PNG) za běhu pomocí knihovny Sharp. To šetří místo v repozitáři a dává plnou kontrolu nad vstupními daty.
- **`process-helpers.ts`**: Wrapper nad `spawn` pro spouštění `scripts/generate-images.ts` jako child procesu. Řeší timeouty a zachytávání stdout/stderr.
- **`manifest-assert.ts`**: Normalizuje JSON manifest (řadí klíče, odstraňuje absolutní cesty), aby byl stabilní pro snapshot matching.

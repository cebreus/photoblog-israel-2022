# Testování generování obrázků a blur assetů (Bun + SvelteKit)

Tento dokument popisuje strategii a implementaci testování pro skript `generate-images.ts` a související pipeline pro zpracování obrázků.

## Cíl testování

Zajistit spolehlivost CLI generátoru obrázků (`scripts/generate-images.ts`) včetně:

- **Hlavních přepínačů**: variants, formats, quality, manifest, concurrency, watch, clean, gif mód.
- **Blur pipeliny**: generování LQIP (Low-Quality Image Placeholders) a blur assetů.
- **Integrity dat**: kontrola vygenerovaného manifestu (`images.manifest.json`) a struktury adresářů.
- **Determinismu**: zajištění konzistentních výstupů pro cache a snapshot testy.

## Strategie testování

Testy jsou rozděleny do tří úrovní a běží v prostředí Bun (pro unit/integration) a Playwright (pro E2E).

1.  **Jednotkové testy (Unit Tests)**:
    - Testují izolované funkce (parsování argumentů, normalizace cest, logika manifestu).
    - Rychlé, bez I/O operací (pokud možno).

2.  **Integrační testy (Integration Tests)**:
    - Testují celé CLI volání v kontrolovaném prostředí.
    - Používají programově generované fixtury (obrázky).
    - Ověřují výstupní soubory a obsah JSON manifestu proti snapshotům.

3.  **End-to-End testy (E2E Tests)**:
    - `demo.test.ts` (Playwright) testuje vizuální stránku komponent v prohlížeči.

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

Testy pro obrázky používají specializovanou konfiguraci `vitest.config.images.ts`, která:

- Nastavuje prostředí `node`.
- Definuje delší timeouty pro operace s obrázky (60s).
- Určuje sériové spouštění pro integrační testy (pro determinismus a prevenci race conditions u souborů).

### Skripty v `package.json`

```bash
# Spustí pouze unit testy pro obrázky
bun run test:unit:images

# Spustí integrační a E2E testy pro obrázky (s omezením vláken pro determinismus)
bun run test:images

# Spustí všechny testy související s obrázky
bun run test:all
```

> **Poznámka:** Skript `test:images` nastavuje `SHARP_NUM_THREADS=1` pro zajištění deterministických výstupů při kompresi obrázků, což je klíčové pro snapshot testy binárních dat (pokud jsou prováděny) a pro stabilitu na CI.

## Implementované testy

### `generate-and-blur.int.spec.ts`

Tento soubor obsahuje klíčové integrační scénáře:

1.  **Main Images Generation**:
    - Spustí CLI s plnou sadou parametrů (formats, quality, clean).
    - Vygeneruje vstupní sadu obrázků (JPEG, PNG, GIF).
    - Ověří, že vznikl `images.manifest.json`.
    - Porovná normalizovaný manifest se snapshotem.
    - Ověří strukturu výstupních adresářů.

2.  **GIF Handling**:
    - Ověřuje režim `--gif=copy`, kdy se animované GIFy pouze kopírují a nekonvertují.

3.  **Blur Assets**:
    - Testuje generování malých PNG palet (blur placeholders).
    - Ověřuje rozměry a počet barev (PNG-8, max 32 barev).
    - Ověřuje čistící režim (`--clean`), který odstraní nepotřebné formáty z předchozích běhů.

### `images-cli.unit.spec.ts`

Testuje logiku parsování CLI argumentů v `scripts/lib/cli-parser.ts`:

- Ověřuje výchozí hodnoty.
- Testuje prioritizaci flagů (CLI args > config defaults).
- Validuje nepovolené kombinace.
- Testuje detekci `--manifestOnly` a dalších speciálních flagů.

### `manifest-builder.unit.spec.ts`

Testuje funkci `buildGeneratorManifest` a `updateManifest`:

- Zajišťuje, že struktura JSON odpovídá očekávání frontendu.
- Testuje výpočty rozměrů a hashování.

## Pomocné utility

- **`fixtures.ts`**: Místo ukládání binárních obrázků do gitu si testy generují vstupy (JPEG, PNG, GIF) za běhu pomocí knihovny Sharp. To šetří místo v repozitáři a dává plnou kontrolu nad vstupními daty.
- **`process-helpers.ts`**: Wrapper nad `spawn` pro spouštění `scripts/generate-images.ts` jako child procesu. Řeší timeouty a zachytávání stdout/stderr.
- **`manifest-assert.ts`**: Normalizuje JSON manifest (řadí klíče, odstraňuje absolutní cesty), aby byl stabilní pro snapshot matching.

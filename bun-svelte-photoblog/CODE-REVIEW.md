# Code Review: Image Generation System (Bun/SvelteKit)

Komplexní analýza kódové báze generování obrázků v `/bun-svelte-photoblog` dle principů SOLID, KISS, YAGNI, DRY a best practices pro výkon, udržovatelnost a čitelnost.

---

## Přehled analyzovaných komponent

1. **CLI generátor**: [scripts/generate-images.ts](bun-svelte-photoblog/scripts/generate-images.ts:1) (1323 řádků)
2. **Runtime helpers**: [src/lib/images.ts](bun-svelte-photoblog/src/lib/images.ts:1) (117 řádků)
3. **UI komponenta**: [src/lib/components/Picture.svelte](bun-svelte-photoblog/src/lib/components/Picture.svelte:1) (125 řádků)
4. **Test utility**: [tests/utils/\*.ts](bun-svelte-photoblog/tests/utils/) (5 souborů)

---

## 1. SOLID Principy

### ✅ Single Responsibility Principle (SRP)

**Pozitivní:**

- Funkce mají jasně definované odpovědnosti:
  - [parseArgs()](bun-svelte-photoblog/scripts/generate-images.ts:136) – pouze parsování CLI
  - [generatePlaceholder()](bun-svelte-photoblog/scripts/generate-images.ts:546) – pouze LQIP
  - [dominantColorHex()](bun-svelte-photoblog/scripts/generate-images.ts:568) – pouze dominantní barva
  - [transformVariant()](bun-svelte-photoblog/scripts/generate-images.ts:594) – transformace jedné varianty
  - [buildAll()](bun-svelte-photoblog/scripts/generate-images.ts:951) – orchestrace celého běhu

**Porušení a doporučení:**

- ⚠️ [processSourceFile()](bun-svelte-photoblog/scripts/generate-images.ts:713) má příliš mnoho odpovědností (150+ řádků):
  - Detekce cache
  - Rozhodování o copy vs transform
  - Generování variant
  - Aktualizace cache
  - Tvorba manifest entry

  **Refaktoring:**

  ```typescript
  // Rozdělit na menší funkce:
  async function shouldSkipProcessing(
    absSrc,
    cache,
    expectedOutputs,
  ): Promise<boolean>;
  async function createManifestEntry(
    absSrc,
    variants,
    placeholder,
    color,
  ): Promise<ManifestEntry>;
  async function processWithTransforms(absSrc, cache): Promise<ProcessResult>;
  async function processCopyOnly(absSrc): Promise<ProcessResult>;
  ```

### ✅ Open/Closed Principle (OCP)

**Pozitivní:**

- [VARIANT_CONFIGS](bun-svelte-photoblog/scripts/generate-images.ts:36) umožňuje přidávat nové varianty bez změny logiky
- Formáty (avif/webp/jpeg) jsou parametrizované

**Porušení:**

- ⚠️ [parseArgs()](bun-svelte-photoblog/scripts/generate-images.ts:136) používá obří switch s 30+ case větve

  **Refaktoring:**

  ```typescript
  // Použít map-based přístup:
  type ArgHandler = (value: string, args: Args) => void;
  const ARG_HANDLERS: Record<string, ArgHandler> = {
    src: (v, a) => (a.src = path.resolve(process.cwd(), v)),
    out: (v, a) => (a.out = path.resolve(process.cwd(), v)),
    // ...
  };

  function parseArgs(argv: string[]): Args {
    const out = { ...DEFAULTS };
    for (const arg of argv) {
      if (!arg.startsWith('--')) continue;
      const [k, v] = arg.slice(2).split('=');
      ARG_HANDLERS[k]?.(v ?? 'true', out);
    }
    return out;
  }
  ```

### ⚠️ Liskov Substitution Principle (LSP)

- Není přímo aplikovatelné (žádná dědičnost), ale:
- [transformVariant()](bun-svelte-photoblog/scripts/generate-images.ts:594) a [transformAndWrite()](bun-svelte-photoblog/scripts/generate-images.ts:655) mají podobné signatury, ale různé chování

  **Doporučení:** Sjednotit nebo jasně odlišit účel (transformAndWrite se zdá být nepoužívaná funkce – YAGNI porušení)

### ✅ Interface Segregation Principle (ISP)

**Pozitivní:**

- Typy jsou dobře segregované (Args, Manifest, Cache, Variant)
- Runtime helpers v [images.ts](bun-svelte-photoblog/src/lib/images.ts:1) exportují pouze potřebné funkce

### ⚠️ Dependency Inversion Principle (DIP)

**Porušení:**

- Globální `sharp` proměnná a `ARGS` jsou přímé závislosti v celém modulu
- [processSourceFile()](bun-svelte-photoblog/scripts/generate-images.ts:713) přímo závisí na globálním `CTX` a `ARGS`

  **Refaktoring:**

  ```typescript
  // Dependency injection:
  type ProcessorDeps = {
    sharp: SharpModule | null;
    args: Args;
    ctx: ProcessContext;
    cache: Cache;
  };

  async function processSourceFile(absSrc: string, deps: ProcessorDeps): Promise<...>
  ```

---

## 2. KISS (Keep It Simple, Stupid)

### ✅ Pozitivní příklady jednoduchosti:

- [toPosix()](bun-svelte-photoblog/scripts/generate-images.ts:328) – jednoduchá konverze cest
- [hexFromRGB()](bun-svelte-photoblog/scripts/generate-images.ts:340) – přímočará konverze barev
- [buildSrcSet()](bun-svelte-photoblog/src/lib/images.ts:46) – čistá transformace pole

### ⚠️ Zbytečná složitost:

1. **Duplicitní logika pro načítání Sharp instance**
   - [transformVariant()](bun-svelte-photoblog/scripts/generate-images.ts:611) a [transformAndWrite()](bun-svelte-photoblog/scripts/generate-images.ts:666) obě obsahují:

   ```typescript
   const img =
     typeof imgOrSrc === 'string'
       ? sharp(imgOrSrc).rotate().withMetadata({ icc: 'srgb' })
       : imgOrSrc;
   ```

   **Refaktoring:**

   ```typescript
   function prepareSharpInstance(
     imgOrSrc: SharpInstance | string,
   ): SharpInstance {
     return typeof imgOrSrc === 'string'
       ? sharp!(imgOrSrc).rotate().withMetadata({ icc: 'srgb' })
       : imgOrSrc;
   }
   ```

2. **Složitá cache logika v processSourceFile**
   - Řádky 733-788: vnořené podmínky a duplicitní čtení metadat

   **Refaktoring:** Extrahovat do `checkCacheAndSkip()`

3. **Redundantní funkce**
   - [transformAndWrite()](bun-svelte-photoblog/scripts/generate-images.ts:655) se zdá být nepoužívaná (grep nenašel volání)
   - [computeTargetWidths()](bun-svelte-photoblog/scripts/generate-images.ts:580) se nepoužívá
   - [mimeFromExt()](bun-svelte-photoblog/scripts/generate-images.ts:360) se nepoužívá
   - [copyFilePreserve()](bun-svelte-photoblog/scripts/generate-images.ts:587) se nepoužívá
   - [changeExt()](bun-svelte-photoblog/scripts/generate-images.ts:1066) v blur sekci se nepoužívá

   **Akce:** Odstranit nepoužívané funkce (YAGNI)

---

## 3. YAGNI (You Aren't Gonna Need It)

### ⚠️ Zbytečné abstrakce a kód:

1. **Nepoužívané funkce** (viz KISS výše):
   - transformAndWrite, computeTargetWidths, mimeFromExt, copyFilePreserve, changeExt

2. **Zbytečně komplexní typ Args**
   - 24 polí v jedné struktuře; lepší by bylo rozdělit na:

   ```typescript
   type MainArgs = { src, out, manifest, variants, formats, quality, ... };
   type BlurArgs = { enable, only, src, out, width, colors, ... };
   type RuntimeArgs = { concurrency, watch, clean, verbose, quiet, limit };
   type Args = MainArgs & BlurArgs & RuntimeArgs;
   ```

3. **Duplicitní typy mezi generate-images.ts a images.ts**
   - Typy Variant, VariantsByFormat, Placeholder, ManifestEntry jsou definované dvakrát

   **Refaktoring:** Vytvořit sdílený types.ts:

   ```typescript
   // src/lib/types/images.ts
   export type Variant = { ... };
   export type ManifestEntry = { ... };
   // Import v obou souborech
   ```

4. **Nepoužívaná proměnná staticRelDir**
   - [processSourceFile:719](bun-svelte-photoblog/scripts/generate-images.ts:719) – vypočítá se, ale nikdy se nepoužije

---

## 4. DRY (Don't Repeat Yourself)

### ⚠️ Opakující se vzory:

1. **Duplicitní Sharp format aplikace**
   - [transformVariant:633-638](bun-svelte-photoblog/scripts/generate-images.ts:633) a [transformAndWrite:668-677](bun-svelte-photoblog/scripts/generate-images.ts:668) a [generateBlurAssets:1147-1168](bun-svelte-photoblog/scripts/generate-images.ts:1147)

   **Refaktoring:**

   ```typescript
   function applyFormat(
     img: SharpInstance,
     format: 'avif' | 'webp' | 'jpeg',
     quality: number,
   ) {
     switch (format) {
       case 'avif':
         return img.avif({ quality, effort: 5, chromaSubsampling: '4:2:0' });
       case 'webp':
         return img.webp({ quality, effort: 4 });
       case 'jpeg':
         return img.jpeg({
           quality,
           chromaSubsampling: '4:2:0',
           progressive: true,
           mozjpeg: false,
         });
     }
   }
   ```

2. **Opakované čtení metadat výstupu**
   - [transformVariant:644-650](bun-svelte-photoblog/scripts/generate-images.ts:644) a [transformAndWrite:683-690](bun-svelte-photoblog/scripts/generate-images.ts:683)

   **Refaktoring:**

   ```typescript
   async function getOutputDimensions(
     outFile: string,
     fallbackW: number,
     fallbackH: number,
   ) {
     try {
       const meta = await sharp!(outFile).metadata();
       return {
         width: meta.width ?? fallbackW,
         height: meta.height ?? fallbackH,
       };
     } catch {
       return { width: fallbackW, height: fallbackH };
     }
   }
   ```

3. **Duplicitní progress bar setup**
   - [buildAll:962-969](bun-svelte-photoblog/scripts/generate-images.ts:962) a [generateBlurAssets:1108-1114](bun-svelte-photoblog/scripts/generate-images.ts:1108)

   **Refaktoring:**

   ```typescript
   function createProgressBar(label: string, total: number, quiet: boolean) {
     if (quiet) return null;
     const bar = new SingleBar({
       format: `${label} [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s`,
       barCompleteChar: '\u2588',
       barIncompleteChar: '\u2591',
       hideCursor: true,
     });
     bar.start(total, 0);
     return bar;
   }
   ```

4. **Opakované řazení manifestu**
   - [buildAll:1004-1005](bun-svelte-photoblog/scripts/generate-images.ts:1004), [handleFileEvent:1221](bun-svelte-photoblog/scripts/generate-images.ts:1221), [handleFileEvent:1231](bun-svelte-photoblog/scripts/generate-images.ts:1231)

   **Refaktoring:**

   ```typescript
   function sortManifest(m: Manifest): Manifest {
     return Object.fromEntries(
       Object.entries(m).sort(([a], [b]) => a.localeCompare(b)),
     );
   }
   ```

---

## 5. Výkonové problémy

### ⚠️ Kritické bottlenecky:

1. **Duplicitní čtení hash v cache check**
   - [processSourceFile:763](bun-svelte-photoblog/scripts/generate-images.ts:763) a [processSourceFile:792](bun-svelte-photoblog/scripts/generate-images.ts:792)
   - Hash se počítá dvakrát pro stejný soubor, pokud outputs existují ale cache chybí

   **Dopad:** O(N) zbytečných I/O operací při prvním běhu s existujícími výstupy

   **Refaktoring:** Vypočítat hash jednou a cachovat v lokální proměnné

2. **Neefektivní metadata čtení po zápisu**
   - [transformVariant:644-650](bun-svelte-photoblog/scripts/generate-images.ts:644) – po `toFile()` se znovu načítá metadata
   - Sharp může vrátit metadata přímo z pipeline bez dalšího čtení

   **Refaktoring:**

   ```typescript
   const { info } = await img.toFile(outFile);
   const outW = info.width;
   const outH = info.height;
   ```

3. **Paralelní tasks v processSourceFile bez limitu**
   - [processSourceFile:823-848](bun-svelte-photoblog/scripts/generate-images.ts:823) vytváří tasks pro všechny varianty × formáty
   - Pak volá `runWithConcurrency(tasks, ARGS.concurrency)` – ale tasks už běží!
   - Tasks jsou Promise, které se spustí okamžitě při vytvoření

   **Problém:** Concurrency limit se aplikuje až na úrovni souborů, ne variant

   **Refaktoring:** Použít lazy promises (funkce vracející Promise):

   ```typescript
   const taskFns: Array<() => Promise<void>> = [];
   for (const variant of ARGS.variants) {
     for (const fmt of ARGS.formats) {
       taskFns.push(async () => {
         const result = await transformVariant(...);
         list.push(result);
       });
     }
   }
   await runWithConcurrency(taskFns.map(fn => fn()), ARGS.concurrency);
   ```

4. **Neefektivní cleanOrphans**
   - [cleanOrphans:1030](bun-svelte-photoblog/scripts/generate-images.ts:1030) listuje všechny soubory v outRoot
   - Pro velké adresáře (tisíce souborů) je to pomalé

   **Optimalizace:** Použít streaming přístup nebo batch delete

### ✅ Pozitivní výkonové prvky:

- Concurrency control přes [runWithConcurrency()](bun-svelte-photoblog/scripts/generate-images.ts:912)
- Cache s hash validací
- Lazy Sharp loading
- Clone() pro sdílení base image

---

## 6. Čitelnost a udržovatelnost

### ⚠️ Problémy:

1. **Magické konstanty**
   - Pevné hodnoty rozptýlené v kódu:
     - quality: 40 ([generatePlaceholder:555](bun-svelte-photoblog/scripts/generate-images.ts:555))
     - effort: 5, 4 ([transformVariant:634-636](bun-svelte-photoblog/scripts/generate-images.ts:634))
     - blur(20px) ([Picture.svelte:115](bun-svelte-photoblog/src/lib/components/Picture.svelte:115))

   **Refaktoring:** Definovat jako konstanty na začátku:

   ```typescript
   const LQIP_QUALITY = 40;
   const AVIF_EFFORT = 5;
   const WEBP_EFFORT = 4;
   const UI_BLUR_RADIUS_PX = 20;
   ```

2. **Dlouhé funkce**
   - [processSourceFile()](bun-svelte-photoblog/scripts/generate-images.ts:713): 193 řádků
   - [main()](bun-svelte-photoblog/scripts/generate-images.ts:1243): 76 řádků

   **Doporučení:** Rozdělit na menší, testovatelné jednotky (max 50 řádků)

3. **Nekonzistentní error handling**
   - Některé funkce vracejí null při chybě ([readMetadata:534](bun-svelte-photoblog/scripts/generate-images.ts:534))
   - Jiné throwují ([transformVariant:601](bun-svelte-photoblog/scripts/generate-images.ts:601))
   - Jiné logují a pokračují ([processSourceFile:901-904](bun-svelte-photoblog/scripts/generate-images.ts:901))

   **Refaktoring:** Jednotná strategie – buď Result<T, E> pattern nebo konzistentní throw/catch

4. **Komentáře místo jasných názvů**
   - `// e.g. "content/images/album/photo.jpg"` ([processSourceFile:715](bun-svelte-photoblog/scripts/generate-images.ts:715))
   - Lepší: `const manifestKey = relKeyFromAbs(absSrc);`

### ✅ Pozitivní:

- Dobré jmenování funkcí (generatePlaceholder, dominantColorHex)
- Logické sekce s komentáři
- TypeScript typy jsou explicitní

---

## 7. Specifické code smells

### 🔴 Kritické:

1. **Unused function transformAndWrite**
   - [Řádky 655-693](bun-svelte-photoblog/scripts/generate-images.ts:655)
   - Nikde se nevolá → smazat

2. **Double semicolon**
   - [DEFAULTS:134](bun-svelte-photoblog/scripts/generate-images.ts:134): `};;`
   - Syntax error waiting to happen

3. **Unsafe non-null assertion**
   - [generateBlurAssets:1135](bun-svelte-photoblog/scripts/generate-images.ts:1135): `sharp!(abs)`
   - Už je ověřeno na začátku funkce, ale lepší pattern:

   ```typescript
   if (!sharp) throw new Error('...');
   const s = sharp; // type narrowing
   ```

4. **Missing await**
   - [transformVariant:639](bun-svelte-photoblog/scripts/generate-images.ts:639): `} await img.toFile(outFile);`
   - Syntax error (} před await)

### ⚠️ Středně závažné:

1. **Globální side effects**
   - [Řádek 251](bun-svelte-photoblog/scripts/generate-images.ts:251): `const ARGS = parseArgs(process.argv.slice(2));`
   - Spouští se při importu modulu → ztěžuje testování

   **Refaktoring:** Přesunout do main() a předávat jako parametr

2. **Inconsistent path handling**
   - Někdy `path.resolve(process.cwd(), v)` ([parseArgs:144](bun-svelte-photoblog/scripts/generate-images.ts:144))
   - Jindy `path.resolve(ARGS.src)` ([CTX:503](bun-svelte-photoblog/scripts/generate-images.ts:503))
   - Může vést k nekonzistentním cestám při změně cwd

3. **Type assertions**
   - `as any` na více místech ([parseArgs:156](bun-svelte-photoblog/scripts/generate-images.ts:156), [parseArgs:186](bun-svelte-photoblog/scripts/generate-images.ts:186))
   - Lepší: explicitní type guards

---

## 8. Test utility – code review

### ✅ Pozitivní:

- [fixtures.ts](bun-svelte-photoblog/tests/utils/fixtures.ts:1) – čistá generace testovacích dat
- [manifest-assert.ts](bun-svelte-photoblog/tests/utils/manifest-assert.ts:1) – dobrá normalizace pro snapshoty

### ⚠️ Problémy:

1. **Missing error handling v fixtures**
   - [buildInputSet()](bun-svelte-photoblog/tests/utils/fixtures.ts:21) nemá try/catch
   - Pokud sharp selže, test spadne s nečitelnou chybou

2. **Hardcoded base64 GIF**
   - [fixtures.ts:9](bun-svelte-photoblog/tests/utils/fixtures.ts:9)
   - Lepší: generovat programově nebo načíst z fixture souboru

3. **Type duplication v manifest-assert**
   - [manifest-assert.ts:7-20](bun-svelte-photoblog/tests/utils/manifest-assert.ts:7) – duplikuje typy z images.ts
   - Použít import z $lib/images

---

## 9. Picture.svelte – component review

### ✅ Pozitivní:

- Čistá separace logiky a prezentace
- Reaktivní statements jsou efektivní
- Dobré fallbacky pro chybějící manifest

### ⚠️ Problémy:

1. **Unsafe non-null assertion**
   - [Řádek 21](bun-svelte-photoblog/src/lib/components/Picture.svelte:21): `$: imgOptions = getImgFallback(entry!, sizes);`
   - Pokud entry je undefined, spadne to

   **Refaktoring:**

   ```typescript
   $: imgOptions = entry ? getImgFallback(entry, sizes) : null;
   ```

2. **Redundantní ternary**
   - [Řádek 53](bun-svelte-photoblog/src/lib/components/Picture.svelte:53): `${$$props.style ? $$props.style : ''}`
   - Lepší: `${$$props.style ?? ''}`

3. **Magic number**
   - blur(20px) – mělo by být CSS custom property pro konfiguraci

---

## 10. Prioritizovaná doporučení pro refaktoring

### 🔴 Vysoká priorita (bezpečnost a korektnost):

1. **Opravit syntax error** v [transformVariant:639](bun-svelte-photoblog/scripts/generate-images.ts:639)

   ```typescript
   // Před: } await img.toFile(outFile);
   // Po:
   }
   await img.toFile(outFile);
   ```

2. **Odstranit nepoužívané funkce** (YAGNI):
   - transformAndWrite, computeTargetWidths, mimeFromExt, copyFilePreserve, changeExt

3. **Opravit double semicolon** [DEFAULTS:134](bun-svelte-photoblog/scripts/generate-images.ts:134)

4. **Opravit unsafe non-null v Picture.svelte** [řádek 21](bun-svelte-photoblog/src/lib/components/Picture.svelte:21)

### 🟡 Střední priorita (výkon):

5. **Optimalizovat duplicitní hash čtení** v processSourceFile

6. **Použít Sharp toFile() info** místo re-read metadat

7. **Opravit eager Promise execution** v processSourceFile tasks

8. **Extrahovat duplicitní format aplikaci** do applyFormat()

### 🟢 Nízká priorita (čistota kódu):

9. **Refaktorovat parseArgs** na map-based přístup

10. **Rozdělit processSourceFile** na menší funkce

11. **Vytvořit sdílené types.ts** pro odstranění duplikace typů

12. **Přesunout ARGS parsing** do main() místo module-level

13. **Definovat magické konstanty** (LQIP_QUALITY, effort values, blur radius)

---

## 11. Metriky kódu

### Současný stav:

- **generate-images.ts**: 1323 řádků (příliš velký monolitický soubor)
- **Cyklomatická složitost**:
  - parseArgs: ~35 (vysoká – switch s 30+ větvemi)
  - processSourceFile: ~25 (vysoká – vnořené podmínky)
  - main: ~10 (přijatelná)
- **Duplicitní kód**: ~15% (format aplikace, metadata čtení, progress bar)
- **Nepoužitý kód**: ~5% (5 funkcí)

### Cílový stav po refactoringu:

- Rozdělit generate-images.ts na moduly:
  - cli-parser.ts (~150 řádků)
  - image-processor.ts (~300 řádků)
  - blur-generator.ts (~200 řádků)
  - cache-manager.ts (~100 řádků)
  - main.ts (~100 řádků)
- Cyklomatická složitost < 15 pro všechny funkce
- Duplicitní kód < 3%
- Nepoužitý kód = 0%

---

## 12. Bezpečnost a robustnost

### ✅ Pozitivní:

- Path traversal ochrana: [isInsideDir()](bun-svelte-photoblog/scripts/generate-images.ts:416)
- Validace vstupů v parseArgs (Math.max/min)
- Try/catch v kritických místech

### ⚠️ Zlepšení:

1. **Chybějící validace cest**
   - parseArgs přijímá libovolné cesty bez kontroly existence nebo práv

   **Doporučení:** Přidat validaci v main() před spuštěním

2. **Race condition v watch mode**
   - [handleFileEvent](bun-svelte-photoblog/scripts/generate-images.ts:1204) nemá debounce
   - Rychlé změny mohou způsobit konfliktní zápisy do manifestu

   **Refaktoring:** Přidat debounce nebo queue

---

## 13. Testovatelnost

### ⚠️ Problémy:

1. **Globální stav** (ARGS, CTX, sharp) ztěžuje unit testy
2. **Side effects při importu** (parseArgs se volá na module level)
3. **Těsné coupling** na file system (těžko mockovat)

### Doporučení:

- Dependency injection pro sharp, args, ctx
- Pure functions kde možné
- Abstrakce file system operací (např. FileSystem interface)

---

## 14. Konkrétní akční plán refactoringu

### Fáze 1: Kritické opravy (1-2 hodiny)

1. Opravit syntax error v transformVariant
2. Odstranit nepoužívané funkce
3. Opravit double semicolon
4. Opravit unsafe non-null v Picture.svelte

### Fáze 2: Výkonové optimalizace (2-3 hodiny)

5. Eliminovat duplicitní hash čtení
6. Použít Sharp toFile() info
7. Opravit eager Promise execution
8. Extrahovat applyFormat() helper

### Fáze 3: Strukturální refaktoring (4-6 hodin)

9. Rozdělit generate-images.ts na moduly
10. Refaktorovat parseArgs na map-based
11. Vytvořit sdílené types
12. Přesunout ARGS do main()

### Fáze 4: Čistota kódu (2-3 hodiny)

13. Definovat konstanty
14. Sjednotit error handling
15. Přidat path validaci
16. Debounce pro watch mode

---

## 15. Závěr a doporučení

### Celkové hodnocení:

- **Funkčnost**: ✅ Plně funkční, splňuje požadavky
- **SOLID**: ⚠️ Částečné porušení SRP, DIP
- **KISS**: ⚠️ Zbytečná složitost v parseArgs a processSourceFile
- **YAGNI**: ⚠️ ~5% nepoužitého kódu
- **DRY**: ⚠️ ~15% duplicitního kódu
- **Výkon**: ⚠️ Několik bottlenecků (duplicitní I/O, neefektivní paralelizace)
- **Testovatelnost**: ⚠️ Globální stav ztěžuje unit testy

### Prioritní kroky:

1. **Okamžitě**: Opravit syntax error a unsafe assertions (bezpečnost)
2. **Krátký termín**: Odstranit nepoužitý kód, optimalizovat I/O (výkon)
3. **Střední termín**: Rozdělit monolitický soubor, refaktorovat parseArgs (udržovatelnost)
4. **Dlouhý termín**: Dependency injection, pure functions (testovatelnost)

### Doporučený postup:

- Začít s Fází 1 (kritické opravy) před nasazením do produkce
- Fáze 2 (výkon) provést před škálováním na větší datasety
- Fáze 3-4 postupně v rámci běžné údržby

Kód je funkční a dobře strukturovaný na vysoké úrovni, ale obsahuje několik anti-patterns a výkonových problémů, které by měly být adresovány pro dlouhodobou udržovatelnost a škálovatelnost.

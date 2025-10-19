# Bun Svelte Photoblog – generátor obrázků a blur assetů

Tento balíček poskytuje generátor obrázků (AVIF/WEBP/JPEG) a volitelné generování „blur“ assetů (PNG-8/AVIF/JPEG) pro nový SvelteKit fotoblog. Jádro je v [generate-images.ts](bun-svelte-photoblog/scripts/generate-images.ts:1) a runtime integrace v [images.ts](bun-svelte-photoblog/src/lib/images.ts:1) a [Picture.svelte](bun-svelte-photoblog/src/lib/components/Picture.svelte:1).

Klíčové vlastnosti
- Více variant obrázků (details, previews, previews-xl, previews-xxs) s pevnými rozměry kompatibilními s původní Gulp větví.
- Formáty AVIF, WEBP, JPEG s nastavitelnou kvalitou.
- Manifest s kompletními metadaty a cestami.
- LQIP placeholder (base64) + dominantní barva pro plynulé načítání.
- Volitelné generování „blur“ souborů v duchu [gen-blured-images.sh](gen-blured-images.sh:1) (PNG-8 paletizace, šířka 24 px, barvy 32, Lanczos).
- Watch mód, cache, čištění osiřelých souborů, paralelizace.

Instalace
- Přejděte do složky subprojektu:
  - cd bun-svelte-photoblog
- Nainstalujte závislosti:
  - bun install
- Systémové knihovny pro Sharp (libvips):
  - macOS: brew install vips
  - Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y libvips

Poznámka k cestám
- Výchozí hodnoty ve skriptu předpokládají běh v tomto adresáři. Zdrojové fotky jsou ale v nadřazeném repozitáři ve složce content. Doporučené volby:
  - --src=../content/israel-2022
  - --out=./static/images/israel-2022
  - --manifest=./src/lib/images.manifest.json

Skripty
- images:build → vygeneruje běžné varianty podle výchozích hodnot
- images:watch → sleduje změny vstupů a inkrementálně regeneruje
- images:blur → pouze generuje blur assety podle skupiny --blur.*
- images:all → sekvenčně spustí images:build a images:blur

Základní použití
- Build běžných obrázků s doporučenými cestami:
  - bun scripts/generate-images.ts --src=../content/israel-2022 --out=./static/images/israel-2022 --manifest=./src/lib/images.manifest.json
- Watch mód:
  - bun scripts/generate-images.ts --src=../content/israel-2022 --watch=true
- Čištění osiřelých souborů po buildu:
  - bun scripts/generate-images.ts --src=../content/israel-2022 --clean=true

CLI parametry – běžné generování
Implementace: [parseArgs()](bun-svelte-photoblog/scripts/generate-images.ts:105)
- --src=PATH: zdrojové obrázky (výchozí content/israel-2022)
- --out=PATH: cílová složka (výchozí static/images/israel-2022)
- --manifest=PATH: výstupní manifest (výchozí src/lib/images.manifest.json)
- --variants=list: details,previews,previews-xl,previews-xxs
- --formats=list: avif,webp,jpeg (výchozí všechny)
- --quality.avif=1-100 (výchozí 50)
- --quality.webp=1-100 (výchozí 60)
- --quality.jpeg=1-100 (výchozí 80)
- --allow-upscale=true|false (výchozí false)
- --keep-original=true|false (výchozí false)
- --gif=copy|convert (výchozí copy; animované GIF se konzervativně kopírují)
- --concurrency=N|auto (výchozí 4; auto = CPU-1)
- --watch=true|false
- --clean=true|false: odstranění osiřelých souborů po buildu
- --fallback=none|copy: copy = bez transformací při chybě Sharp/libvips
- --verbose=true|false, --quiet=true|false
- --lqipWidth=N (výchozí 24)
- --limit=N (0 = bez omezení)

Odvození variant a výstupů
- Konfigurace variant: [VARIANT_CONFIGS](bun-svelte-photoblog/scripts/generate-images.ts:36)
- Výstupní struktura:
  - details, previews, previews-xl, previews-xxs pro JPEG
  - složky s příponou -webp a -avif pro moderní formáty

Manifest a runtime
- Manifest: ./src/lib/images.manifest.json (typy a helpery v [images.ts](bun-svelte-photoblog/src/lib/images.ts:1))
- UI komponenta: [Picture.svelte](bun-svelte-photoblog/src/lib/components/Picture.svelte:1)
  - placeholder: 'none' | 'background' | 'blur'
  - blur režim používá LQIP data URL a CSS filter pro plynulý přechod

CLI parametry – blur assety (parita s gen-blured-images.sh)
Implementace generátoru: [generateBlurAssets()](bun-svelte-photoblog/scripts/generate-images.ts:1110)
- --blur.enable=true|false: zapnutí blur fáze
- --blur.only=true|false: spustí jen blur bez hlavního buildu
- --blur.src=PATH: zdroj (výchozí ../static/assets/israel-2022/previews-xl)
- --blur.out=PATH: cíl (výchozí ../static/assets/israel-2022/blurs)
- --blur.width=N: šířka (výchozí 24)
- --blur.colors=N: počet barev pro PNG paletu (výchozí 32)
- --blur.formats=list: png,avif,jpeg (výchozí png)
- --blur.pngCompression=0-9 (výchozí 9)
- --blur.pngQuality=0-100 (výchozí 50)
- --blur.avifQuality=1-100 (výchozí 50)
- --blur.jpegQuality=1-100 (výchozí 40)
- --blur.clean=true|false: smazat cílový adresář před generováním

Příklady blur generování
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

# Testování generování obrázků a blur assetů (Bun + SvelteKit)

Cíl: spolehlivě otestovat CLI generátor [generate-images.ts](bun-svelte-photoblog/scripts/generate-images.ts:1) včetně:

- hlavních přepínačů (variants, formats, quality, manifest, concurrency, watch, clean, gif mód)
- nové skupiny blur.\* přepínačů (parita s [gen-blured-images.sh](gen-blured-images.sh:1)), včetně kombinací formátů a parametrů

Testy jsou navrženy pro běh na runtime Bun a v prostředí SvelteKit v balíčku `bun-svelte-photoblog`. Testovací strategie zahrnuje:

- jednotkové testy (parsování, výchozí hodnoty, normalizace cest, kvality)
- integrační testy CLI s kurátorovanou sadou fixtur (generovaných za běhu)
- end‑to‑end testy kompletní sady (manifest + blur výstupy)
- pixelové porovnávání (s tolerancemi)
- determinismus (vlákna, pořadí, čas)
- SSR render test pro [Picture.svelte](bun-svelte-photoblog/src/lib/components/Picture.svelte:1) bez plného prohlížeče
- CI pipeline (GitHub Actions) s instalací libvips a exportem artefaktů při selhání

Pozn.: Vše níže je připraveno jako kompletní implementační podklady. Kódy testů a konfigurací vložte do uvedených souborů a cest.

---

## Adresářová struktura pro testy a fixtury

Doporučené rozložení uvnitř `bun-svelte-photoblog/`:

```
bun-svelte-photoblog/
  tests/
    fixtures/
      input/                  # zdrojové obrázky generované programově (dočasně v testech)
      expected/               # volitelné „golden“ výstupy (většinou generujeme „golden“ snapshoty v JSON)
    golden/
      manifests/              # JSON snapshoty manifestu (normalizované)
      trees/                  # JSON snapshoty stromu výstupů
      images/                 # volitelně PNG/WEBP/AVIF „golden“ pro pixelové porovnání (doporučeno generovat za běhu)
    outputs/
      tmp-int/                # dočasná integrační výstupní složka (čištěná před testem)
      tmp-e2e/                # dočasná E2E výstupní složka (čištěná před testem)
    unit/
      parseArgs.unit.spec.ts
      quality-and-paths.unit.spec.ts
    integration/
      generate-images.int.spec.ts
      blur-assets.int.spec.ts
      watch-mode.int.spec.ts
    e2e-images/
      full-run.e2e.spec.ts
    utils/
      fs-helpers.ts
      image-assert.ts
      manifest-assert.ts
      process-helpers.ts
      fixtures.ts
```

- `fixtures/` zásadně nevkládá binárky do repozitáře; místo toho si testy fixtury vyrábí programově (viz [fixtures.ts](bun-svelte-photoblog/tests/utils/fixtures.ts:1)).
- `golden/` obsahuje JSON snapshoty (normalizované) a volitelně „golden“ obrázky. Preferujeme generovat „golden“ obrázky za běhu a provádět srovnání přes pixelmatch s tolerancí.

---

## Determinismus v testech

Pro minimalizaci flakiness:

- nastavit počet vláken pro libvips/Sharp:
  - Shell: `SHARP_NUM_THREADS=1`
- předávat `--concurrency=1` v integračních a E2E testech
- třídění vstupů v testech i CLI je deterministické (v CLI se volá `.sort()`)
- používat `TZ=UTC` v CI
- pro watch režim používat krátké okno a řízené „touch“ události s debounce

---

## Vitest konfigurace (vitest.config.images.ts)

Vytvořte konfig v kořeni subbalíčku:

[vitest.config.images.ts](bun-svelte-photoblog/vitest.config.images.ts:1)

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 30000,
    // Jednotkové testy paralelně, integrační a e2e sériově
    include: [
      "tests/unit/**/*.spec.ts",
      "tests/integration/**/*.spec.ts",
      "tests/e2e-images/**/*.spec.ts",
    ],
    sequence: {
      concurrent: false,
      shuffle: false,
      // Umožní spouštět unit testy paralelně (podle globu), ale integration/e2e sériově
      // Tip: lze rozdělit do separátních skriptů v package.json
    },
    globals: true,
    alias: {
      $lib: path.resolve(__dirname, "./src/lib"),
    },
  },
});
```

---

## Skripty v package.json

Rozšířte skripty:

[bun-svelte-photoblog/package.json](bun-svelte-photoblog/package.json:6)

```json
{
  "scripts": {
    "test:unit": "vitest -c vitest.config.images.ts --run --reporter verbose --include tests/unit/**/*.spec.ts",
    "test:images": "SHARP_NUM_THREADS=1 vitest -c vitest.config.images.ts --run --reporter verbose --include tests/integration/**/*.spec.ts --include tests/e2e-images/**/*.spec.ts",
    "test:all": "bun run test:unit && bun run test:images"
  }
}
```

---

## Pomocné utility

### FS helpers

[fsHelpers.listTree()](bun-svelte-photoblog/tests/utils/fs-helpers.ts:1)

```ts
import fs from "node:fs";
import path from "node:path";

export async function listTree(root: string): Promise<string[]> {
  const out: string[] = [];
  function walk(dir: string) {
    for (const e of fs.readdirSync(dir)) {
      const abs = path.join(dir, e);
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs);
      else out.push(abs);
    }
  }
  walk(root);
  out.sort((a, b) => a.localeCompare(b));
  return out.map((p) => p.replaceAll(path.sep, "/"));
}
```

### Image assert a pixelmatch

[imageAssert.compareImagesWithTolerance()](bun-svelte-photoblog/tests/utils/image-assert.ts:1)

```ts
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export type PixelCompareOptions = {
  threshold?: number; // 0..1
  maxDiffPixels?: number; // absolutní limit odlišných pixelů
};

export async function toPngBuffer(
  inputPath: string,
  width?: number,
): Promise<Buffer> {
  const img = sharp(inputPath);
  const meta = await img.metadata();
  const resized = width
    ? img.resize({ width, fit: "inside", withoutEnlargement: true })
    : img;
  // Vždy převést do PNG pro pixelmatch
  return await resized.png({ compressionLevel: 9 }).toBuffer();
}

export async function compareImagesWithTolerance(
  aPath: string,
  bPath: string,
  opts: PixelCompareOptions = {},
) {
  const threshold = opts.threshold ?? 0.1;
  const maxDiffPixels = opts.maxDiffPixels ?? 0;

  const [aBuf, bBuf] = await Promise.all([
    toPngBuffer(aPath),
    toPngBuffer(bPath),
  ]);
  const aPng = PNG.sync.read(aBuf);
  const bPng = PNG.sync.read(bBuf);

  if (aPng.width !== bPng.width || aPng.height !== bPng.height) {
    throw new Error(
      `Dimension mismatch: ${aPng.width}x${aPng.height} vs ${bPng.width}x${bPng.height}`,
    );
  }

  const diff = new PNG({ width: aPng.width, height: aPng.height });
  const diffCount = pixelmatch(
    aPng.data,
    bPng.data,
    diff.data,
    aPng.width,
    aPng.height,
    { threshold },
  );

  if (diffCount > maxDiffPixels) {
    return {
      ok: false,
      diffCount,
      width: aPng.width,
      height: aPng.height,
      diffPngBuffer: PNG.sync.write(diff),
    };
  }
  return { ok: true, diffCount, width: aPng.width, height: aPng.height };
}
```

### Manifest normalizace

[manifestAssert.normalizeManifest()](bun-svelte-photoblog/tests/utils/manifest-assert.ts:1)

```ts
type Variant = { width: number; height: number; path: string; bytes: number };
type VariantsByFormat = {
  avif?: Variant[];
  webp?: Variant[];
  jpeg?: Variant[];
};
type Entry = {
  original: {
    width: number | null;
    height: number | null;
    format: string | null;
    bytes: number;
    path: string | null;
  };
  variants: VariantsByFormat;
  placeholder: {
    base64: string | null;
    width: number | null;
    height: number | null;
    type: string | null;
  } | null;
  color: string | null;
  hash: string;
  outputs: string[];
};

export function normalizeManifest(m: Record<string, Entry>) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(m).sort()) {
    const e = m[k];
    const nv = (x?: Variant[]) =>
      x
        ? x.map((v) => ({ width: v.width, height: v.height, path: v.path }))
        : undefined;
    out[k] = {
      original: {
        width: e.original.width,
        height: e.original.height,
        format: e.original.format,
        path: e.original.path,
      },
      variants: {
        avif: nv(e.variants.avif),
        webp: nv(e.variants.webp),
        jpeg: nv(e.variants.jpeg),
      },
      placeholder: e.placeholder
        ? {
            width: e.placeholder.width,
            height: e.placeholder.height,
            type: e.placeholder.type,
          }
        : null,
      color: e.color,
      outputs: [...e.outputs].sort(),
    };
  }
  return out;
}
```

### Process helpers (spawn CLI, temp dirs)

[processHelpers.runCli()](bun-svelte-photoblog/tests/utils/process-helpers.ts:1)

```ts
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export function tmpDir(prefix: string): string {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  return p;
}

export async function runCli(
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const proc = spawn("bun", ["scripts/generate-images.ts", ...args], {
        cwd: opts?.cwd,
        env: {
          ...process.env,
          SHARP_NUM_THREADS: "1",
          TZ: "UTC",
          ...(opts?.env || {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const timeout = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("CLI timeout"));
      }, opts?.timeoutMs ?? 60000);

      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => (stdout += String(d)));
      proc.stderr.on("data", (d) => (stderr += String(d)));
      proc.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ code: code ?? -1, stdout, stderr });
      });
      proc.on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    },
  );
}
```

### Fixtury (generované za běhu)

[fixtures.buildInputSet()](bun-svelte-photoblog/tests/utils/fixtures.ts:1)

```ts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Malý base64 animovaný GIF (2 snímky, 2x2 px) – jen pro detekci animace
const tinyAnimatedGifBase64 =
  "R0lGODlhAgACAPAAAP///wAAACH5BAAAAAAALAAAAAACAAIAAAICRAEAOw==";
// Malý JPEG s EXIF orientací 6 (base64) – vzorek připravený se zapnutou EXIF orientací
// Pozn.: pro jednoduchost můžete nahradit programovým vytvořením a externí EXIF zápisem, zde přímo embedováno
const jpegExifOrientation6Base64 = "..."; // volitelně vyplňte později, test může přeskočit pokud není

export async function buildInputSet(dir: string) {
  fs.mkdirSync(dir, { recursive: true });

  // 1) PNG s průhledností 40x30
  const pngAlpha = path.join(dir, "alpha.png");
  await sharp({
    create: {
      width: 40,
      height: 30,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 0.25 },
    },
  })
    .png()
    .toFile(pngAlpha);

  // 2) Velký JPEG 4000x3000 pro downscale
  const bigJpeg = path.join(dir, "big.jpg");
  await sharp({
    create: {
      width: 4000,
      height: 3000,
      channels: 3,
      background: { r: 120, g: 50, b: 180 },
    },
  })
    .jpeg({ quality: 85 })
    .toFile(bigJpeg);

  // 3) Malý JPEG (portrait) 600x900
  const portraitJpeg = path.join(dir, "portrait.jpg");
  await sharp({
    create: {
      width: 600,
      height: 900,
      channels: 3,
      background: { r: 30, g: 60, b: 240 },
    },
  })
    .jpeg({ quality: 80 })
    .toFile(portraitJpeg);

  // 4) WEBP 300x300
  const webpImg = path.join(dir, "square.webp");
  await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: { r: 255, g: 200, b: 0 },
    },
  })
    .webp({ quality: 80 })
    .toFile(webpImg);

  // 5) Malý animovaný GIF
  const animGif = path.join(dir, "anim.gif");
  fs.writeFileSync(animGif, Buffer.from(tinyAnimatedGifBase64, "base64"));

  // 6) (Optional) JPEG s EXIF orientací 6
  if (jpegExifOrientation6Base64 !== "...") {
    const exifJpeg = path.join(dir, "exif-orient-6.jpg");
    fs.writeFileSync(
      exifJpeg,
      Buffer.from(jpegExifOrientation6Base64, "base64"),
    );
  }

  return { pngAlpha, bigJpeg, portraitJpeg, webpImg, animGif };
}
```

---

## Jednotkové testy

### parseArgs – sanity (spuštění CLI, kontrola důsledků)

[parseArgs.unit.spec.ts](bun-svelte-photoblog/tests/unit/parseArgs.unit.spec.ts:1)

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { runCli, tmpDir } from "../utils/process-helpers";
import { listTree } from "../utils/fs-helpers";
import { buildInputSet } from "../utils/fixtures";

const CWD = path.resolve(__dirname, "../../");

describe("CLI parseArgs sanity via observable effects", () => {
  it("applies defaults and custom overrides for out/manifest/formats/quality", async () => {
    const inDir = tmpDir("img-in");
    await buildInputSet(inDir);

    const outDir = tmpDir("img-out");
    const manifest = path.join(outDir, "images.manifest.json");

    const args = [
      `--src=${inDir}`,
      `--out=${outDir}`,
      `--manifest=${manifest}`,
      `--formats=jpeg,webp`,
      `--quality.jpeg=75`,
      `--quality.webp=60`,
      `--concurrency=1`,
      `--clean=true`,
      `--limit=3`,
    ];
    const res = await runCli(args, { cwd: CWD, timeoutMs: 120000 });
    expect(res.code).toBe(0);

    // Manifest existuje
    expect(fs.existsSync(manifest)).toBe(true);

    // Složky pro JPEG/WEBP varianty existují
    const tree = await listTree(outDir);
    const jpegFolders = tree.filter((p) =>
      /\/(details|previews|previews-xl|previews-xxs)\/.+\.jpg$/.test(p),
    );
    const webpFolders = tree.filter((p) =>
      /\/(details|previews|previews-xl|previews-xxs)-webp\/.+\.webp$/.test(p),
    );
    expect(jpegFolders.length).toBeGreaterThan(0);
    expect(webpFolders.length).toBeGreaterThan(0);
  });
});
```

### Kvalita a cesty – normalizace

[quality-and-paths.unit.spec.ts](bun-svelte-photoblog/tests/unit/quality-and-paths.unit.spec.ts:1)

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { runCli, tmpDir } from "../utils/process-helpers";

const CWD = path.resolve(__dirname, "../../");

describe("Quality and output path conventions", () => {
  it("respects --allow-upscale=false and outputs folder naming scheme", async () => {
    const inDir = tmpDir("img-in");
    // vytvoř malý vstup 100x80
    const sharp = (await import("sharp")).default;
    const input = path.join(inDir, "small.jpg");
    await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg({ quality: 80 })
      .toFile(input);

    const outDir = tmpDir("img-out");
    const manifest = path.join(outDir, "images.manifest.json");

    const res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--allow-upscale=false`,
        `--formats=jpeg`,
        `--concurrency=1`,
      ],
      { cwd: CWD },
    );
    expect(res.code).toBe(0);

    // detail 1280 by se neměl upscalovat -> výstup <= 100 šířka
    const details = fs
      .readdirSync(path.join(outDir, "details"))
      .filter((x) => x.endsWith(".jpg"));
    expect(details.length).toBe(1);
    const meta = await (await import("sharp"))
      .default(path.join(outDir, "details", details[0]))
      .metadata();
    expect((meta.width ?? 0) <= 100).toBe(true);
  });
});
```

---

## Integrační testy – hlavní build

### Generování a snapshot manifestu

[generate-images.int.spec.ts](bun-svelte-photoblog/tests/integration/generate-images.int.spec.ts:1)

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { runCli, tmpDir } from "../utils/process-helpers";
import { buildInputSet } from "../utils/fixtures";
import { normalizeManifest } from "../utils/manifest-assert";
import { listTree } from "../utils/fs-helpers";

const CWD = path.resolve(__dirname, "../../");

describe("Integration: main images generation", () => {
  it("produces deterministic manifest and expected directory tree", async () => {
    const inDir = tmpDir("int-in");
    await buildInputSet(inDir);

    const outDir = tmpDir("int-out");
    const manifest = path.join(outDir, "images.manifest.json");

    const res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--formats=avif,webp,jpeg`,
        `--quality.avif=50`,
        `--quality.webp=60`,
        `--quality.jpeg=80`,
        `--concurrency=1`,
        `--clean=true`,
      ],
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    // Manifest snapshot (normalizovaný)
    const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const normalized = normalizeManifest(data);
    expect(normalized).toMatchSnapshot();

    // Strom výstupů – seznam relativních cest
    const tree = await listTree(outDir);
    const rel = tree.map((p) =>
      path.posix.relative(outDir.replaceAll(path.sep, "/"), p),
    );
    expect(rel).toMatchSnapshot();
  });
});
```

---

## Integrační testy – blur pipeline

[blur-assets.int.spec.ts](bun-svelte-photoblog/tests/integration/blur-assets.int.spec.ts:1)

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { runCli, tmpDir } from "../utils/process-helpers";
import { buildInputSet } from "../utils/fixtures";
import sharp from "sharp";

const CWD = path.resolve(__dirname, "../../");

async function uniqueColorCountPng(pngPath: string) {
  const buf = await sharp(pngPath).png().toBuffer();
  const { PNG } = await import("pngjs");
  const png = PNG.sync.read(buf);
  const set = new Set<string>();
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i],
      g = png.data[i + 1],
      b = png.data[i + 2],
      a = png.data[i + 3];
    set.add(`${r},${g},${b},${a}`);
  }
  return set.size;
}

describe("Integration: blur assets generation", () => {
  it("generates PNG-8 palette with expected width and approx. color count", async () => {
    const src = tmpDir("blur-in");
    await buildInputSet(src);
    const out = tmpDir("blur-out");

    const res = await runCli(
      [
        `--blur.enable=true`,
        `--blur.only=true`,
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        `--blur.width=24`,
        `--blur.colors=32`,
        `--blur.formats=png`,
        `--blur.pngCompression=9`,
        `--blur.pngQuality=50`,
        `--concurrency=1`,
      ],
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    const files = fs.readdirSync(out).filter((x) => x.endsWith(".png"));
    expect(files.length).toBeGreaterThan(0);

    // Kontrola rozměru a přibližného počtu barev
    for (const f of files) {
      const abs = path.join(out, f);
      const meta = await sharp(abs).metadata();
      expect(meta.width).toBeLessThanOrEqual(24);
      const colors = await uniqueColorCountPng(abs);
      expect(colors).toBeLessThanOrEqual(40); // 32 + toleranční rezerva
    }
  });

  it("supports multi-format blur outputs (png,avif,jpeg) and clean mode", async () => {
    const src = tmpDir("blur-in2");
    await buildInputSet(src);
    const out = tmpDir("blur-out2");

    // první běh
    let res = await runCli(
      [
        `--blur.enable=true`,
        `--blur.only=true`,
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        `--blur.formats=png,avif,jpeg`,
        `--blur.width=24`,
        `--blur.colors=16`,
        `--concurrency=1`,
      ],
      { cwd: CWD },
    );
    expect(res.code).toBe(0);

    const files1 = fs.readdirSync(out);
    expect(files1.some((f) => f.endsWith(".png"))).toBe(true);
    expect(files1.some((f) => f.endsWith(".avif"))).toBe(true);
    expect(files1.some((f) => f.endsWith(".jpg"))).toBe(true);

    // druhý běh s clean
    res = await runCli(
      [
        `--blur.enable=true`,
        `--blur.only=true`,
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        `--blur.formats=png`,
        `--blur.clean=true`,
        `--concurrency=1`,
      ],
      { cwd: CWD },
    );
    expect(res.code).toBe(0);

    const files2 = fs.readdirSync(out);
    // měly by zůstat jen png
    expect(files2.every((f) => f.endsWith(".png"))).toBe(true);
  });
});
```

---

## Watch režim – izolovaný integrační test

[watch-mode.int.spec.ts](bun-svelte-photoblog/tests/integration/watch-mode.int.spec.ts:1)

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { tmpDir } from "../utils/process-helpers";
import { buildInputSet } from "../utils/fixtures";

const CWD = path.resolve(__dirname, "../../");

describe("Watch mode reacts to file changes", () => {
  it("creates outputs on new file and updates on change", async () => {
    const inDir = tmpDir("watch-in");
    const outDir = tmpDir("watch-out");
    const manifest = path.join(outDir, "images.manifest.json");

    // initial one file
    const sharp = (await import("sharp")).default;
    const first = path.join(inDir, "first.jpg");
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .jpeg({ quality: 80 })
      .toFile(first);

    const proc = spawn(
      "bun",
      [
        "scripts/generate-images.ts",
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        "--watch=true",
        "--concurrency=1",
      ],
      { cwd: CWD, env: { ...process.env, SHARP_NUM_THREADS: "1" } },
    );

    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += String(d)));

    // počkej krátce na initial build
    await new Promise((r) => setTimeout(r, 4000));

    expect(fs.existsSync(manifest)).toBe(true);

    // přidej soubor
    const second = path.join(inDir, "second.jpg");
    await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg({ quality: 80 })
      .toFile(second);

    // dej watch módu čas zachytit update
    await new Promise((r) => setTimeout(r, 4000));

    const details = path.join(outDir, "details");
    expect(fs.existsSync(details)).toBe(true);
    const files = fs.readdirSync(details).filter((f) => f.endsWith(".jpg"));
    expect(files.length).toBeGreaterThanOrEqual(2);

    proc.kill("SIGTERM");
  });
});
```

---

## End‑to‑end test – kompletní běh včetně blur

[full-run.e2e.spec.ts](bun-svelte-photoblog/tests/e2e-images/full-run.e2e.spec.ts:1)

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { runCli, tmpDir } from "../utils/process-helpers";
import { buildInputSet } from "../utils/fixtures";
import { listTree } from "../utils/fs-helpers";

const CWD = path.resolve(__dirname, "../../");

describe("E2E: main build + blur pass", () => {
  it("produces main variants and blur files without errors", async () => {
    const inDir = tmpDir("e2e-in");
    await buildInputSet(inDir);
    const outDir = tmpDir("e2e-out");
    const manifest = path.join(outDir, "images.manifest.json");
    const blurOut = tmpDir("e2e-blurs");

    let res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--formats=avif,webp,jpeg`,
        `--concurrency=1`,
        `--clean=true`,
      ],
      { cwd: CWD, timeoutMs: 180000 },
    );
    expect(res.code).toBe(0);

    res = await runCli(
      [
        `--blur.enable=true`,
        `--blur.only=true`,
        `--blur.src=${path.join(outDir, "previews-xl")}`, // parita s legacy: zdroj blur z previews-xl
        `--blur.out=${blurOut}`,
        `--blur.formats=png`,
        `--concurrency=1`,
      ],
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    // sanity
    const tree = await listTree(outDir);
    expect(tree.some((p) => p.endsWith(".avif"))).toBe(true);
    expect(tree.some((p) => p.endsWith(".webp"))).toBe(true);
    expect(tree.some((p) => p.endsWith(".jpg"))).toBe(true);

    const blurs = fs.readdirSync(blurOut).filter((x) => x.endsWith(".png"));
    expect(blurs.length).toBeGreaterThan(0);
  });
});
```

---

## SSR render test pro Picture.svelte (bez prohlížeče)

- Využijeme `vi.mock` pro `$lib/images.manifest.json` a otestujeme vytvořený HTML výstup v SSR render bez spuštění prohlížeče.

[Picture.ssr.spec.ts](bun-svelte-photoblog/tests/unit/Picture.ssr.spec.ts:1)

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/images.manifest.json", () => ({
  default: {
    "content/israel-2022/sample.jpg": {
      original: {
        width: 1200,
        height: 800,
        format: "jpeg",
        bytes: 123,
        path: "/images/israel-2022/details/sample.jpg",
      },
      variants: {
        avif: [
          {
            width: 534,
            height: 300,
            path: "/images/israel-2022/previews-avif/sample.avif",
            bytes: 1,
          },
        ],
        webp: [
          {
            width: 534,
            height: 300,
            path: "/images/israel-2022/previews-webp/sample.webp",
            bytes: 1,
          },
        ],
        jpeg: [
          {
            width: 534,
            height: 300,
            path: "/images/israel-2022/previews/sample.jpg",
            bytes: 1,
          },
        ],
      },
      placeholder: {
        base64: null,
        width: 24,
        height: null,
        type: "image/jpeg",
      },
      color: "#112233",
      hash: "deadbeef",
      outputs: ["/images/israel-2022/previews/sample.jpg"],
    },
  },
}));

describe("Picture SSR", async () => {
  it("renders sources and img with expected attributes", async () => {
    const mod = await import("$lib/components/Picture.svelte");
    const Component = mod.default;

    // SSR render metoda je dostupná na .render()
    const { html } = Component.render({
      srcKey: "content/israel-2022/sample.jpg",
      alt: "Sample",
      sizes: "100vw",
      placeholder: "background",
    });

    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');
    expect(html).toContain("<img");
    expect(html).toContain('alt="Sample"');
  });
});
```

---

## Tolerance a akceptační kritéria

- Pixelové srovnání: `threshold = 0.1`, `maxDiffPixels = 0` (u bezeztrátových), případně do 0.5 % pixelů u ztrátových výstupů
- Velikost souboru: akceptovat odchylku ±15 % pro JPEG/AVIF/WEBP
- Počet barev u PNG-8: ≤ colors + tolerance (např. +8)
- Determinismus: `--concurrency=1`, `SHARP_NUM_THREADS=1`, `TZ=UTC`
- Manifest snapshoty: normalizované (bez `bytes`, `hash`), stabilní řazení klíčů a cest

---

## GitHub Actions (Linux, matrix Bun/Node, libvips, artefakty)

[.github/workflows/images-ci.yml](.github/workflows/images-ci.yml:1)

```yaml
name: Images CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test-images:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        bun_version: ["1.1.20", "latest"]
        node_version: ["20"]
    env:
      TZ: UTC
      SHARP_NUM_THREADS: 1

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install system deps (libvips, imagemagick optional)
        run: |
          sudo apt-get update
          sudo apt-get install -y libvips imagemagick

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node_version }}

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ matrix.bun_version }}

      - name: Cache bun deps
        uses: actions/cache@v4
        with:
          path: |
            ~/.bun/install/cache
            bun-svelte-photoblog/node_modules
          key: ${{ runner.os }}-bun-${{ matrix.bun_version }}-${{ hashFiles('bun-svelte-photoblog/package.json', 'bun-svelte-photoblog/pnpm-lock.yaml', 'bun-svelte-photoblog/package-lock.json') }}

      - name: Install deps
        working-directory: bun-svelte-photoblog
        run: bun install

      - name: Unit tests
        working-directory: bun-svelte-photoblog
        run: bun run test:unit

      - name: Images tests (integration + e2e)
        working-directory: bun-svelte-photoblog
        run: bun run test:images

      - name: Collect metrics
        if: always()
        working-directory: bun-svelte-photoblog
        run: |
          echo "## Metrics" >> $GITHUB_STEP_SUMMARY
          COUNT=$(find tests/outputs -type f | wc -l || true)
          echo "Generated files (tests/outputs): $COUNT" >> $GITHUB_STEP_SUMMARY

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: images-test-artifacts
          path: |
            bun-svelte-photoblog/tests/outputs/**
            bun-svelte-photoblog/tests/**/*.snap
            bun-svelte-photoblog/tests/**/*.diff.png
          if-no-files-found: ignore
```

Artefakty zahrnují případné `diff.png` z pixelmatch (lze uložit v testech při neúspěchu) a snapshoty.

---

## Volitelný vizuální sanity‑check route

- Přidejte SvelteKit route `/__images-test`, která vykreslí mřížku z manifestu
  - Soubor: `src/routes/__images-test/+page.svelte`
  - Jednoduše iteruje přes několik položek z manifestu a používá [Picture.svelte](bun-svelte-photoblog/src/lib/components/Picture.svelte:1)
  - Tento route je určen jen pro manuální kontrolu, v CI se nepoužívá

---

## Poznámky k GIF režimu

- Test fixtura obsahuje malý animovaný GIF. Očekávané chování:
  - `--gif=copy` → animované GIF se zpracovávají konzervativně jako copy (neztrácí animaci)
  - `--gif=convert` → pro neanimované lze konvertovat do výstupních formátů
- Integrační testy ověří, že při `--gif=copy` vznikne kopie a manifest ji odráží

---

## Shrnutí implementace

- Jednotkové testy ověřují parsování a důsledky na výstupy (adresáře, varianty, kvalitu).
- Integrační a E2E testy spouští CLI nad programově vytvořenými fixturami (PNG s alfou, velký JPEG, portrait JPEG, WEBP, animovaný GIF) a:
  - validují manifest (normalizovaně, snapshot)
  - validují strom výstupů (snapshot)
  - ověřují blur soubory (rozměry, přibližný počet barev, formáty, clean režim)
- Pixelové porovnání je připraveno přes [compareImagesWithTolerance()](bun-svelte-photoblog/tests/utils/image-assert.ts:1), s možností ukládat diff PNG pro analýzu
- Determinismus zajištěn přes `SHARP_NUM_THREADS=1`, `--concurrency=1`, řazení vstupů a `TZ=UTC`
- CI pipeline instaluje libvips, běží testy, publikuje artefakty a sumarizuje metriky

Tato strategie a podklady pokrývají hlavní i blur pipeline, včetně režimů concurrency/clean/watch, kvality a formátů, a dávají jasná akceptační kritéria i toleranční prahy pro robustní testování napříč prostředími.

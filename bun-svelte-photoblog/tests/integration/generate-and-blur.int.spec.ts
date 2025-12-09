import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
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
      { cwd: CWD, timeoutMs: 180000 },
    );
    expect({ code: res.code, stderr: res.stderr.slice(0, 500) }).toEqual(
      expect.objectContaining({ code: 0 }),
    );

    // Manifest snapshot (normalized)
    expect(fs.existsSync(manifest)).toBe(true);
    const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const normalized = normalizeManifest(data);
    expect(normalized).toMatchSnapshot();

    // Directory tree snapshot (relative to outDir)
    const tree = await listTree(outDir);
    const rel = tree.map((p) =>
      path.posix.relative(outDir.replaceAll(path.sep, "/"), p),
    );
    expect(rel).toMatchSnapshot();

    // Sanity: variants should exist across formats
    expect(tree.some((p) => p.endsWith(".avif"))).toBe(true);
    expect(tree.some((p) => p.endsWith(".webp"))).toBe(true);
    expect(tree.some((p) => p.endsWith(".jpeg"))).toBe(true);
  });

  it("respects GIF mode (copy) for animated GIF inputs", async () => {
    const inDir = tmpDir("int-in-gif");
    await buildInputSet(inDir);

    const outDir = tmpDir("int-out-gif");
    const manifest = path.join(outDir, "images.manifest.json");

    const res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--gif=copy`,
        `--formats=jpeg`,
        `--concurrency=1`,
        `--clean=true`,
        `--limit=1`,
      ],
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    // Expect the original GIF to be mirrored (copy) into out directory structure
    // We don't know exact subfolder, check presence anywhere under outDir
    const tree = await listTree(outDir);
    const gifCopies = tree.filter((p) => p.toLowerCase().endsWith(".gif"));
    expect(gifCopies.length).toBeGreaterThan(0);
  });
});

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
    expect({ code: res.code, stderr: res.stderr.slice(0, 500) }).toEqual(
      expect.objectContaining({ code: 0 }),
    );

    const files = fs.readdirSync(out).filter((x) => x.endsWith(".png"));
    expect(files.length).toBeGreaterThan(0);

    // Width <= 24 and approximate color count <= 32 + tolerance
    for (const f of files) {
      const abs = path.join(out, f);
      const meta = await sharp(abs).metadata();
      expect((meta.width ?? 0) <= 24).toBe(true);
      const colors = await uniqueColorCountPng(abs);
      expect(colors).toBeLessThanOrEqual(40); // 32 + tolerance
    }
  });

  it("generates blur outputs as PNG only and cleans extras", async () => {
    const src = tmpDir("blur-in2");
    await buildInputSet(src);
    const out = tmpDir("blur-out2");

    // first run: even if multiple requested, only png is produced
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
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    let files = fs.readdirSync(out);
    expect(files.some((f) => f.endsWith(".png"))).toBe(true);
    expect(files.some((f) => f.endsWith(".avif"))).toBe(false);
    expect(files.some((f) => f.endsWith(".jpeg"))).toBe(false);

    // second run with clean: only png should remain
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
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    files = fs.readdirSync(out);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith(".png"))).toBe(true);
  });
});

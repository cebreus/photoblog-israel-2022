import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { runCli, tmpDir } from '../utils/process-helpers';
import { listTree } from '../utils/fs-helpers';
import { buildInputSet } from '../utils/fixtures';

const CWD = path.resolve(__dirname, '../../');

/**
 * Jednotkové testy CLI přes pozorovatelné efekty (souborový systém).
 * - Ověří parsování parametrů, výchozí hodnoty a vybrané přepínače
 * - Ověří pravidla pro upscaling a výstupní strukturu složek
 */
describe('CLI (generate-images.ts) – základní chování a parsování parametrů', () => {
  it('aplikuje overrides pro out/manifest/formats/quality a generuje očekávané složky a soubory', async () => {
    const inDir = tmpDir('img-in');
    await buildInputSet(inDir);

    const outDir = tmpDir('img-out');
    const manifest = path.join(outDir, 'images.manifest.json');

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
      // fallback ponecháme 'none' – v CI se instaluje libvips; pokud chybí, testy vyhodnotí exit code != 0
    ];

    const res = await runCli(args, { cwd: CWD, timeoutMs: 120000 });
    expect({
      code: res.code,
      stderr: res.stderr.slice(0, 2000),
    }).toEqual(expect.objectContaining({ code: 0 }));

    // Manifest existuje
    expect(fs.existsSync(manifest)).toBe(true);

    // Složky a soubory pro JPEG (bez suffixu) a WEBP (s -webp suffixem) existují
    const tree = await listTree(outDir);
    const jpegFiles = tree.filter((p) => /\/(details|previews|previews-xl|previews-xxs)\/.+\.jpg$/.test(p));
    const webpFiles = tree.filter((p) => /\/(details|previews|previews-xl|previews-xxs)-webp\/.+\.webp$/.test(p));

    expect(jpegFiles.length).toBeGreaterThan(0);
    expect(webpFiles.length).toBeGreaterThan(0);

    // Sanity: žádné AVIF, protože nebyl vyžádán
    const avifFiles = tree.filter((p) => p.endsWith('.avif'));
    expect(avifFiles.length).toBe(0);
  });

  it('respektuje --allow-upscale=false: detail varianta se nezvětšuje nad původní šířku', async () => {
    const inDir = tmpDir('img-in-small');
    // vytvoř malý vstup 100x80
    const input = path.join(inDir, 'small.jpg');
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

    const outDir = tmpDir('img-out-small');
    const manifest = path.join(outDir, 'images.manifest.json');

    const res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--allow-upscale=false`,
        `--formats=jpeg`,
        `--concurrency=1`,
      ],
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    const detailsDir = path.join(outDir, 'details');
    expect(fs.existsSync(detailsDir)).toBe(true);

    const details = fs.readdirSync(detailsDir).filter((x) => x.endsWith('.jpg'));
    expect(details.length).toBe(1);
    const meta = await sharp(path.join(detailsDir, details[0])).metadata();

    // detail cíluje na 1280px šířku, ale bez upscalu musí zůstat ≤ 100
    expect((meta.width ?? 0) <= 100).toBe(true);
  });

  it('mod --clean=true odstraní osiřelé soubory mezi běhy', async () => {
    const inDir = tmpDir('img-in-clean');
    await buildInputSet(inDir);

    const outDir = tmpDir('img-out-clean');
    const manifest = path.join(outDir, 'images.manifest.json');

    // první běh – tři formáty
    let res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--formats=jpeg,webp,avif`,
        `--concurrency=1`,
        `--clean=true`,
      ],
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    // druhý běh – jen JPEG; clean odstraní vše, co není v novém manifestu
    res = await runCli(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${manifest}`,
        `--formats=jpeg`,
        `--concurrency=1`,
        `--clean=true`,
      ],
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    const tree = await listTree(outDir);
    // již nesmí existovat .webp a .avif po clean
    expect(tree.some((p) => p.endsWith('.webp'))).toBe(false);
    expect(tree.some((p) => p.endsWith('.avif'))).toBe(false);
    expect(tree.some((p) => p.endsWith('.jpg'))).toBe(true);
  });
});

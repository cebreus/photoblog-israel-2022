/**
 * @fileoverview Image Generator CLI Integration Tests
 *
 * @description
 * Integration tests for the `generate-images` CLI script.
 * Verifies the end-to-end process of generating image variants (WebP/JPEG),
 * handling manifests, cleaning orphaned files, and respecting flags like --allow-upscale.
 * Uses a real filesystem in a temporary directory.
 *
 * @modules-tested
 * - scripts/generate-images.ts
 * - scripts/lib/image-processor.ts
 */

import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { exiftool } from "exiftool-vendored";
import { afterAll, describe, expect, it, vi } from "vitest";
import * as processor from "../../../scripts/lib/image/processor";
import { buildInputSet } from "../../utils/fixtures";
import { listTree } from "../../utils/fs-helpers";
import { runGenerator } from "../../utils/process-helpers";

// Prevent ExifTool from closing between tests
vi.spyOn(processor, "cleanup").mockImplementation(async () => {});

// We use real filesystem, so no need to mock node:fs or sharp (mostly).
// However, we want to ensure we don't pollute the project root.
// process-helpers.runGenerator handles CWD mocking.

import { config } from "../../../scripts/build.config";

const CWD = path.resolve(__dirname, "../../");

async function getTmpDir(prefix: string): Promise<string> {
  const tmpRoot = path.join(CWD, config.paths.tmp, "test-artifacts");
  const exists = await Bun.file(tmpRoot).exists();
  if (!exists) {
    await mkdir(tmpRoot, { recursive: true });
  }
  return mkdtemp(path.join(tmpRoot, `${prefix}-`));
}

// Ensure cleanup of tmp artifacts (optional, or rely on .gitignore)
// For now, we leave them for inspection on failure, or could clean in afterAll.

describe("CLI (generate-images.ts) – Integration with real FS", { timeout: 30000 }, () => {
  it("generates expected folders and files from input", async () => {
    const workingsDir = await getTmpDir("cli-test");
    const inDir = path.join(workingsDir, "in");
    const outDir = path.join(workingsDir, "out");
    const manifest = path.join(outDir, "images.manifest.json");
    const cache = path.join(workingsDir, "images.cache.json");

    await mkdir(outDir, { recursive: true });

    await buildInputSet(inDir);

    const args = [
      `--src=${inDir}`,
      `--out=${outDir}`,
      `--manifest=${manifest}`,
      `--cache=${cache}`,
      `--formats=jpeg,webp`,
      `--quality.jpeg=75`,
      `--concurrency=1`,
      `--limit=3`,
      `--quiet`,
    ];

    // Pre-seed cache to prevent "config mismatch" deletion of outDir
    const { sha1 } = await import("../../../scripts/lib/image/utils");
    const configHash = sha1(Buffer.from(JSON.stringify(config)));
    const initialCache = {
      version: 17, // Must match CACHE_VERSION in generate-images.ts
      configHash,
      files: {},
    };
    await Bun.write(cache, JSON.stringify(initialCache));

    const res = await runGenerator(args, { cwd: CWD });
    expect(res.code).toBe(0);

    const manifestExists = await Bun.file(manifest).exists();
    expect(manifestExists).toBe(true);

    // Check output tree
    const tree = await listTree(outDir);
    const jpegFiles = tree.filter((p) => p.endsWith(".jpeg"));
    const webpFiles = tree.filter((p) => p.endsWith(".webp"));

    expect(jpegFiles.length).toBeGreaterThan(0);
    expect(webpFiles.length).toBeGreaterThan(0);
  });

  it("respects --allow-upscale=false", async () => {
    const workingsDir = await getTmpDir("openscale-test");
    const inDir = path.join(workingsDir, "in");
    const outDir = path.join(workingsDir, "out");

    await mkdir(inDir, { recursive: true });

    // Create small image manually via sharp (imports are real now)
    const sharp = (await import("sharp")).default;
    const smallImg = path.join(inDir, "small.jpeg");
    await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toFile(smallImg);

    const args = [
      `--src=${inDir}`,
      `--out=${outDir}`,
      `--manifest=${path.join(outDir, "manifest.json")}`,
      `--cache=${path.join(workingsDir, "cache.json")}`,
      `--allow-upscale=false`,
      `--formats=jpeg`,
      `--concurrency=1`,
      `--quiet`,
    ];

    const res = await runGenerator(args, { cwd: CWD });
    expect(res.code).toBe(0);

    const detailsDir = path.join(outDir, "details");
    const { readdir } = await import("node:fs/promises");
    const param = (await readdir(detailsDir)).find((x) => x.endsWith(".jpeg"));

    expect(param).toBeDefined();
    if (!param) return;

    const meta = await sharp(path.join(detailsDir, param)).metadata();
    expect(meta.width).toBeLessThanOrEqual(100);
  });

  it("cleans orphaned files with --clean=true", async () => {
    const workingsDir = await getTmpDir("clean-test");
    const inDir = path.join(workingsDir, "in");
    const outDir = path.join(workingsDir, "out");
    await buildInputSet(inDir);

    // Run 1: JPEG + WEBP
    await runGenerator(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${path.join(outDir, "m.json")}`,
        `--cache=${path.join(workingsDir, "c.json")}`,
        `--formats=jpeg,webp`,
        `--clean=true`,
        `--quiet`,
      ],
      { cwd: CWD },
    );

    expect((await listTree(outDir)).some((p) => p.endsWith(".webp"))).toBe(true);

    // Run 2: JPEG only
    await runGenerator(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${path.join(outDir, "m.json")}`,
        `--cache=${path.join(workingsDir, "c.json")}`,
        `--formats=jpeg`,
        `--clean=true`,
        `--quiet`,
      ],
      { cwd: CWD },
    );

    const tree = await listTree(outDir);
    expect(tree.some((p) => p.endsWith(".webp"))).toBe(false);
    expect(tree.some((p) => p.endsWith(".jpeg"))).toBe(true);
  });

  afterAll(async () => {
    await exiftool.end();
  });
});

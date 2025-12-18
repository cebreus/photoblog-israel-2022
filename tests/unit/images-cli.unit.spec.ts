import { exiftool } from "exiftool-vendored";
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import * as processor from "../../scripts/lib/image-processor";
import { buildInputSet } from "../utils/fixtures";
import { listTree } from "../utils/fs-helpers";
import { runGenerator } from "../utils/process-helpers";

// Prevent ExifTool from closing between tests
vi.spyOn(processor, "cleanup").mockImplementation(async () => {});

// We use real filesystem, so no need to mock node:fs or sharp (mostly).
// However, we want to ensure we don't pollute the project root.
// process-helpers.runGenerator handles CWD mocking.

import { config } from "../../scripts/config";

const CWD = path.resolve(__dirname, "../../");

function getTmpDir(prefix: string) {
  const tmpRoot = path.join(CWD, config.paths.tmp, "test-artifacts");
  if (!fs.existsSync(tmpRoot)) {
    fs.mkdirSync(tmpRoot, { recursive: true });
  }
  return fs.mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

// Ensure cleanup of tmp artifacts (optional, or rely on .gitignore)
// For now, we leave them for inspection on failure, or could clean in afterAll.

describe("CLI (generate-images.ts) – Integration with real FS", { timeout: 30000 }, () => {
  it("generates expected folders and files from input", async () => {
    const workingsDir = getTmpDir("cli-test");
    const inDir = path.join(workingsDir, "in");
    const outDir = path.join(workingsDir, "out");
    const manifest = path.join(outDir, "images.manifest.json");

    await buildInputSet(inDir);

    const args = [
      `--src=${inDir}`,
      `--out=${outDir}`,
      `--manifest=${manifest}`,
      `--formats=jpeg,webp`,
      `--quality.jpeg=75`,
      `--concurrency=1`,
      `--clean=true`,
      `--limit=3`,
    ];

    const res = await runGenerator(args, { cwd: CWD });
    expect(res.code).toBe(0);

    expect(fs.existsSync(manifest)).toBe(true);

    // Check output tree
    const tree = await listTree(outDir);
    const jpegFiles = tree.filter((p) => p.endsWith(".jpeg"));
    const webpFiles = tree.filter((p) => p.endsWith(".webp"));

    expect(jpegFiles.length).toBeGreaterThan(0);
    expect(webpFiles.length).toBeGreaterThan(0);
  });

  it("respects --allow-upscale=false", async () => {
    const workingsDir = getTmpDir("openscale-test");
    const inDir = path.join(workingsDir, "in");
    const outDir = path.join(workingsDir, "out");

    fs.mkdirSync(inDir, { recursive: true });

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
      `--allow-upscale=false`,
      `--formats=jpeg`,
      `--concurrency=1`,
    ];

    const res = await runGenerator(args, { cwd: CWD });
    expect(res.code).toBe(0);

    const detailsDir = path.join(outDir, "details");
    const param = (await fs.promises.readdir(detailsDir)).find((x) => x.endsWith(".jpeg"));

    const meta = await sharp(path.join(detailsDir, param!)).metadata();
    expect(meta.width).toBeLessThanOrEqual(100);
  });

  it("cleans orphaned files with --clean=true", async () => {
    const workingsDir = getTmpDir("clean-test");
    const inDir = path.join(workingsDir, "in");
    const outDir = path.join(workingsDir, "out");
    await buildInputSet(inDir);

    // Run 1: JPEG + WEBP
    await runGenerator(
      [
        `--src=${inDir}`,
        `--out=${outDir}`,
        `--manifest=${path.join(outDir, "m.json")}`,
        `--formats=jpeg,webp`,
        `--clean=true`,
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
        `--formats=jpeg`,
        `--clean=true`,
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

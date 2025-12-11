import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { vol } from "memfs";
import { runGenerator } from "../utils/process-helpers";
import { buildInputSet } from "../utils/fixtures";
import { listTree } from "../utils/fs-helpers"; // Import the mocked version

// Mocking 'node:fs' and 'node:fs/promises' with 'memfs'
vi.mock("node:fs", async () => {
  const memfs = await vi.importActual("memfs");
  return memfs.fs;
});
vi.mock("node:fs/promises", async () => {
  const memfs = await vi.importActual("memfs");
  return memfs.fs.promises;
});

// Mocking sharp to prevent actual image processing
vi.mock("sharp", () => {
  const mockSharpInstance = {
    metadata: vi.fn(() =>
      Promise.resolve({ width: 100, height: 80, format: "jpeg" }),
    ),
    resize: vi.fn(() => mockSharpInstance),
    jpeg: vi.fn(() => mockSharpInstance),
    webp: vi.fn(() => mockSharpInstance),
    avif: vi.fn(() => mockSharpInstance),
    png: vi.fn(() => mockSharpInstance),
    gif: vi.fn(() => mockSharpInstance),
    toFile: vi.fn((file) => {
      // Simulate writing a file to memfs
      vol.writeFileSync(file, Buffer.from("mock-image-content"));
      return Promise.resolve({ width: 100, height: 80, size: 1000 });
    }),
    toBuffer: vi.fn(() => Promise.resolve(Buffer.from("mock-image-buffer"))),
    // Simulate `sharp({ create: ... })` and `sharp(filepath)`
    constructor: vi.fn((input) => {
      // If `create` is present, it's a creation
      if (input && input.create) {
        return mockSharpInstance;
      }
      // Otherwise, it's reading an existing file.
      // We can assert the file exists in memfs if needed, but for now, just return instance.
      return mockSharpInstance;
    }),
  };
  return {
    default: vi.fn(function (input) {
      // @ts-ignore
      return new mockSharpInstance.constructor(input);
    }),
  };
});

// Mock console.log and console.error to prevent excessive output during tests
const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

// Mock CWD to match the project root for consistent path resolution in memfs
const CWD = path.resolve(__dirname, "../../");
vi.mock("node:process", async (importActual) => {
  const actual = await importActual<typeof import("node:process")>();
  return {
    ...actual,
    cwd: () => CWD,
  };
});

// Use memfs for tmpDir
const MOCKED_TMP_ROOT = "/tmp-mock";
const tmpDir = (prefix: string): string => {
  const dirPath = path.join(
    MOCKED_TMP_ROOT,
    `${prefix}-${Math.random().toString(36).substring(7)}`,
  );
  vol.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

// Mock listTree from fs-helpers to use memfs
vi.mock("../utils/fs-helpers", async (importActual) => {
  const actual = await importActual<typeof import("../utils/fs-helpers")>();
  return {
    ...actual,
    listTree: vi.fn(async (dir) => {
      const files: string[] = [];
      const walk = (currentPath: string) => {
        const entries = vol.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isFile()) {
            files.push(fullPath);
          } else if (entry.isDirectory()) {
            walk(fullPath);
          }
        }
      };
      walk(dir);
      return files.map((p) => path.relative(dir, p)); // Return relative paths
    }),
  };
});

// Setup and teardown for memfs and spies
beforeEach(() => {
  vol.reset(); // Clear the in-memory file system before each test
  vol.mkdirSync(CWD, { recursive: true }); // Ensure CWD exists in memfs
  consoleLogSpy.mockClear();
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks(); // Restore all mocks after each test
});

// Original file content starts here

/**
 * Jednotkové testy CLI přes pozorovatelné efekty (souborový systém).
 * - Ověří parsování parametrů, výchozí hodnoty a vybrané přepínače
 * - Ověří pravidla pro upscaling a výstupní strukturu složek
 */
describe("CLI (generate-images.ts) – základní chování a parsování parametrů", () => {
  it("aplikuje overrides pro out/manifest/formats/quality a generuje očekávané složky a soubory", async () => {
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
    const jpegFiles = tree.filter((p) =>
      /\/(details|previews|previews-xl|previews-xxs)\/.+\.jpeg$/.test(p),
    );
    const webpFiles = tree.filter((p) =>
      /\/(details|previews|previews-xl|previews-xxs)-webp\/.+\.webp$/.test(p),
    );

    expect(jpegFiles.length).toBeGreaterThan(0);
    expect(webpFiles.length).toBeGreaterThan(0);

    // Sanity: žádné AVIF, protože nebyl vyžádán
    const avifFiles = tree.filter((p) => p.endsWith(".avif"));
    expect(avifFiles.length).toBe(0);
  });

  it("respektuje --allow-upscale=false: detail varianta se nezvětšuje nad původní šířku", async () => {
    const inDir = tmpDir("img-in-small");
    // vytvoř malý vstup 100x80
    const input = path.join(inDir, "small.jpeg");
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

    const outDir = tmpDir("img-out-small");
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
      { cwd: CWD, timeoutMs: 120000 },
    );
    expect(res.code).toBe(0);

    const detailsDir = path.join(outDir, "details");
    expect(fs.existsSync(detailsDir)).toBe(true);

    const details = fs
      .readdirSync(detailsDir)
      .filter((x) => x.endsWith(".jpeg"));
    expect(details.length).toBe(1);
    const meta = await sharp(path.join(detailsDir, details[0])).metadata();

    // detail cíluje na 1280px šířku, ale bez upscalu musí zůstat ≤ 100
    expect((meta.width ?? 0) <= 100).toBe(true);
  });

  it("mod --clean=true odstraní osiřelé soubory mezi běhy", async () => {
    const inDir = tmpDir("img-in-clean");
    await buildInputSet(inDir);

    const outDir = tmpDir("img-out-clean");
    const manifest = path.join(outDir, "images.manifest.json");

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
    expect(tree.some((p) => p.endsWith(".webp"))).toBe(false);
    expect(tree.some((p) => p.endsWith(".avif"))).toBe(false);
    expect(tree.some((p) => p.endsWith(".jpeg"))).toBe(true);
  });
});

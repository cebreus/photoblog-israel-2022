import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildInputSet } from "$tests/utils/fixtures";
import { runScript, tmpDir } from "$tests/utils/process-helpers";

const CWD = process.cwd();

describe("Integration: manage blur CLI", () => {
  it("generates blur placeholders successfully (happy path)", async () => {
    const src = tmpDir("blur-cli-in");
    await buildInputSet(src);
    const out = tmpDir("blur-cli-out");

    const res = await runScript(
      "scripts/generate-images.ts",
      [
        "--blur.enable=true",
        "--blur.only=true",
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        "--blur.width=20",
        "--blur.formats=png",
        "--concurrency=1",
      ],
      { cwd: CWD },
    );

    expect(res.code).toBe(0);
    const files = await readdir(out);
    expect(files.some((f: string) => f.endsWith(".png"))).toBe(true);

    // Verify width
    const firstPng = files.find((f: string) => f.endsWith(".png"));
    expect(firstPng).toBeDefined();
    const meta = await sharp(path.join(out, firstPng as string)).metadata();
    expect(meta.width).toBeLessThanOrEqual(20);
  });

  it("fails on unknown arguments (strict parsing)", async () => {
    const src = tmpDir("blur-cli-fail-in");
    const out = tmpDir("blur-cli-fail-out");

    const res = await runScript(
      "scripts/generate-images.ts",
      [
        "--blur.enable=true",
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        "--non-existent-flag=true", // Should cause failure
      ],
      { cwd: CWD },
    );

    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain("Unknown argument: --non-existent-flag");
  });

  it("fails on invalid numeric values", async () => {
    const src = tmpDir("blur-cli-fail-val");
    const out = tmpDir("blur-cli-fail-val-out");

    const res = await runScript(
      "scripts/generate-images.ts",
      [
        "--blur.enable=true",
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        "--blur.width=not-a-number", // Should cause failure
      ],
      { cwd: CWD },
    );

    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain("Invalid value for blur.width");
  });

  it("fails on values out of range", async () => {
    const src = tmpDir("blur-cli-fail-range");
    const out = tmpDir("blur-cli-fail-range-out");

    const res = await runScript(
      "scripts/generate-images.ts",
      [
        "--blur.enable=true",
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        "--blur.colors=9000", // Max is 256
      ],
      { cwd: CWD },
    );

    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain("must be between");
  });

  it("cleans output directory when requested", async () => {
    const src = tmpDir("blur-clean-in");
    await buildInputSet(src);
    const out = tmpDir("blur-clean-out");
    await mkdir(out, { recursive: true });
    await Bun.write(path.join(out, "old-file.txt"), "delete me");

    const res = await runScript(
      "scripts/generate-images.ts",
      [
        "--blur.enable=true",
        "--blur.only=true",
        `--blur.src=${src}`,
        `--blur.out=${out}`,
        "--blur.clean=true",
        "--concurrency=1",
      ],
      { cwd: CWD },
    );

    expect(res.code).toBe(0);
    const files = await readdir(out);
    expect(files.includes("old-file.txt")).toBe(false);
    expect(files.some((f: string) => f.endsWith(".png"))).toBe(true);
  });
});

/**
 * @fileoverview CLI Parser Unit Tests (App)
 *
 * @description
 * Tests the frontend/application CLI argument parser.
 * Verifies that command-line arguments are correctly parsed into configuration objects,
 * distinct from the scripts-only parser.
 *
 * @modules-tested
 * - src/lib/utils/cli-parser.ts (or similar app-level parser)
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_CLI_OPTIONS, parseCliArguments } from "../../../scripts/lib/core/cli-parser";

describe("CLI Parser", () => {
  describe("parseCliArguments", () => {
    it("returns defaults with no arguments", () => {
      const result = parseCliArguments([]);
      expect(result.manifestOnly).toBe(false);
      expect(result.allowUpscale).toBe(DEFAULT_CLI_OPTIONS.allowUpscale);
      expect(result.concurrency).toBe(Math.max(1, (require("node:os").cpus()?.length || 2) - 1));
    });

    it("parses quality.avif parameter", () => {
      const result = parseCliArguments(["--quality.avif=85"]);
      expect(result.quality.avif).toBe(85);
    });

    it("throws when quality.avif is out of range", () => {
      expect(() => parseCliArguments(["--quality.avif=150"])).toThrow(/between/);
      expect(() => parseCliArguments(["--quality.avif=-10"])).toThrow(/between/);
    });

    it("parses quality.webp parameter", () => {
      const result = parseCliArguments(["--quality.webp=90"]);
      expect(result.quality.webp).toBe(90);
    });

    it("parses quality.jpeg parameter", () => {
      const result = parseCliArguments(["--quality.jpeg=95"]);
      expect(result.quality.jpeg).toBe(95);
    });

    it("parses manifest-only boolean", () => {
      const resultTrue = parseCliArguments(["--manifest-only=true"]);
      expect(resultTrue.manifestOnly).toBe(true);

      const resultFalse = parseCliArguments(["--manifest-only=false"]);
      expect(resultFalse.manifestOnly).toBe(false);
    });

    it("parses allow-upscale boolean", () => {
      const result = parseCliArguments(["--allow-upscale=true"]);
      expect(result.allowUpscale).toBe(true);
    });

    it("parses keep-original boolean", () => {
      const result = parseCliArguments(["--keep-original=true"]);
      expect(result.keepOriginal).toBe(true);
    });

    it("parses concurrency with range validation", () => {
      const result = parseCliArguments(["--concurrency=4"]);
      expect(result.concurrency).toBe(4);

      expect(() => parseCliArguments(["--concurrency=0"])).toThrow(/between/);
    });

    it("parses lqipWidth with range validation", () => {
      const result = parseCliArguments(["--lqipWidth=50"]);
      expect(result.lqipWidth).toBe(50);

      expect(() => parseCliArguments(["--lqipWidth=-10"])).toThrow(/between/);
    });

    it("parses multiple blur quality parameters", () => {
      const result = parseCliArguments([
        "--blur.avifQuality=80",
        "--blur.jpegQuality=90",
        "--blur.pngQuality=95",
      ]);

      expect(result.blurAvifQuality).toBe(80);
      expect(result.blurJpegQuality).toBe(90);
      expect(result.blurPngQuality).toBe(95);
    });

    it("parses blur boolean flags", () => {
      const result = parseCliArguments([
        "--blur.enable=true",
        "--blur.only=true",
        "--blur.clean=true",
      ]);

      expect(result.blurEnable).toBe(true);
      expect(result.blurOnly).toBe(true);
      expect(result.blurClean).toBe(true);
    });

    it("throws on invalid numeric values", () => {
      expect(() => parseCliArguments(["--quality.avif=invalid"])).toThrow(/not a number/);
    });

    it("parses curation flag", () => {
      const result = parseCliArguments(["--curation=true"]);
      expect(result.curation).toBe(true);
    });

    it("handles multiple arguments together", () => {
      const result = parseCliArguments([
        "--manifest-only=true",
        "--quality.avif=85",
        "--concurrency=8",
        "--curation=true",
      ]);

      expect(result.manifestOnly).toBe(true);
      expect(result.quality.avif).toBe(85);
      expect(result.concurrency).toBe(8);
      expect(result.curation).toBe(true);
    });
  });
});

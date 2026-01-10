import { describe, expect, it } from "vitest";
import { runScript } from "$tests/utils/process-helpers";

describe("Integration: manage.ts CLI", () => {
  it("uses gallery specified via --gallery and passes flags to sub-command", async () => {
    const res = await runScript(
      "scripts/manage.ts",
      ["images", "--gallery=israel-2022", "--limit=1", "--manifest-only", "--verbose"],
      {
        env: { LOG_LEVEL: "verbose" },
      },
    );

    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/Generating Image Variants .*israel-2022/);
    // manage.ts passes a custom title for 'images'
    expect(res.stdout).toMatch(/Image Variants/);
  }, 40000);

  it("uses gallery specified via CONTENT_DIR environment variable", async () => {
    const res = await runScript(
      "scripts/manage.ts",
      ["images", "--limit=1", "--manifest-only", "--verbose"],
      {
        env: { CONTENT_DIR: "egypt-2025", LOG_LEVEL: "verbose" },
      },
    );

    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/Generating Image Variants .*egypt-2025/);
  }, 40000);

  it("falls back to default gallery when invalid gallery is provided in non-TTY", async () => {
    const res = await runScript(
      "scripts/manage.ts",
      ["images", "--gallery=non-existent-gallery", "--limit=1", "--manifest-only", "--verbose"],
      {
        env: { LOG_LEVEL: "verbose" },
      },
    );

    // The warning about invalid gallery
    expect(res.stdout).toMatch(/Gallery "non-existent-gallery" not found/);
    // Should fallback to egypt-2025
    expect(res.stdout).toMatch(/egypt-2025/);
    expect(res.code).toBe(0);
  }, 40000);

  it("passes specific flags like --threshold to sub-commands", async () => {
    const res = await runScript(
      "scripts/manage.ts",
      ["faces", "--gallery=egypt-2025", "--manifest-only", "--threshold=0.8", "--verbose"],
      {
        env: { LOG_LEVEL: "verbose" },
      },
    );

    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/Face Clustering/);
    expect(res.stdout).toMatch(/egypt-2025/);
  }, 40000);
});

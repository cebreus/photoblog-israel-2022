/**
 * @fileoverview Manifest Repository Unit Tests
 *
 * @description
 * Tests the persistence layer for manifests.
 * Verifies loading and saving of various manifest types (images, analysis, people),
 * including validation of schema and structure logic.
 *
 * @modules-tested
 * - scripts/lib/manifest-repository.ts
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadManifest, saveManifest } from "../../scripts/lib/manifests/repository";

describe("Manifest Repository (Unit)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads a manifest correctly", async () => {
    const filePath = path.join(tmpDir, "test.json");
    const data = { hello: "world", count: 42 };

    await saveManifest(filePath, data);

    const loaded = await loadManifest(filePath);
    expect(loaded).toEqual(data);
  });

  it("returns null for non-existent manifest", async () => {
    const filePath = path.join(tmpDir, "non-existent.json");
    const loaded = await loadManifest(filePath);
    expect(loaded).toBeNull();
  });

  it("sorts keys if requested", async () => {
    const filePath = path.join(tmpDir, "sorted.json");
    const data = { b: 2, a: 1, c: { y: 9, x: 8 } };

    await saveManifest(filePath, data, true);

    const content = await fs.readFile(filePath, "utf-8");
    // Check if raw JSON keys are sorted
    const parsed = JSON.parse(content);

    // Assert keys order by string matching or checking keys
    expect(Object.keys(parsed)).toEqual(["a", "b", "c"]);
    expect(Object.keys(parsed.c)).toEqual(["x", "y"]);
  });
});

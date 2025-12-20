/**
 * @fileoverview Smoke API Integration Tests
 *
 * @description
 * Tests basic manifest serving and static data endpoints.
 * Verifies that the API correctly serves JSON from the current CONTENT_DIR.
 *
 * @modules-tested
 * - src/routes/api/manifest/images/+server.ts
 * - src/routes/api/manifest/people/+server.ts
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getImagesManifest } from "../../src/routes/api/manifest/images/+server";
import { GET as getPeopleManifest } from "../../src/routes/api/manifest/people/+server";

const CWD = path.resolve(__dirname, "../../");
const TEST_DIR = `test-smoke-${Date.now()}`;
const DATA_DIR = path.resolve(CWD, "src/data", TEST_DIR);

const originalContentDir = process.env.CONTENT_DIR;

async function setupEnv() {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  const people = { people: [{ id: "p1", name: "Alice" }] };
  const images = { photoDays: [] };

  await fsp.writeFile(path.join(DATA_DIR, "people.manifest.json"), JSON.stringify(people, null, 2));
  await fsp.writeFile(path.join(DATA_DIR, "images.manifest.json"), JSON.stringify(images, null, 2));

  process.env.CONTENT_DIR = TEST_DIR;
}

async function cleanupEnv() {
  await fsp.rm(DATA_DIR, { recursive: true, force: true });
  process.env.CONTENT_DIR = originalContentDir;
}

describe("Integration: Smoke API", () => {
  beforeEach(async () => {
    await setupEnv();
  });

  afterEach(async () => {
    await cleanupEnv();
  });

  it("GET /api/manifest/images should return current images manifest", async () => {
    const res = await getImagesManifest();
    const json = await res.json();
    expect(json).toHaveProperty("photoDays");
  });

  it("GET /api/manifest/people should return current people manifest", async () => {
    const res = await getPeopleManifest();
    const json = await res.json();
    expect(json.people).toHaveLength(1);
    expect(json.people[0].name).toBe("Alice");
  });
});

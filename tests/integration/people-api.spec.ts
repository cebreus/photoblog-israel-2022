/**
 * @fileoverview People API Integration Tests
 *
 * @description
 * Tests the server-side API endpoints for managing people (Faces).
 * Verifies renaming, merging, and unmatching logic, including filesystem operations
 * and manifest updates.
 *
 * @modules-tested
 * - src/routes/api/people/rename/+server.ts
 * - src/routes/api/people/merge/+server.ts
 * - src/routes/api/people/unmatch/+server.ts
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as mergePost } from "../../src/routes/api/people/merge/+server";
import { POST as renamePost } from "../../src/routes/api/people/rename/+server";
import { POST as unmatchPost } from "../../src/routes/api/people/unmatch/+server";

const CWD = path.resolve(__dirname, "../../");
const TEST_DIR = `test-people-api-${Date.now()}`;
const DATA_DIR = path.resolve(CWD, "src/data", TEST_DIR);
const STATIC_DIR = path.resolve(CWD, "static", TEST_DIR);

const _originalCwd = process.cwd;
const originalContentDir = process.env.CONTENT_DIR;

// Utilities to setup mock environment
async function setupEnv() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(path.resolve(STATIC_DIR, "faces"), { recursive: true });

  // Create initial manifests
  const people = [
    {
      id: "person-1",
      name: "Alice",
      faceCount: 2,
      faceDescriptor: [0.1],
      thumbnail: "faces/person-1/img1.jpg",
      ignored: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "person-2",
      name: "Bob",
      faceCount: 1,
      faceDescriptor: [0.9],
      thumbnail: "faces/person-2/img2.jpg",
      ignored: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
  ];
  const images = {
    photoDays: [
      {
        date: "2025-01-01",
        id: "2025-01-01",
        items: [
          {
            type: "image",
            id: "img1",
            people: ["person-1"],
            src: "img1.jpg",
            alt: "img1",
            sources: [],
          },
          {
            type: "image",
            id: "img2",
            people: ["person-2"],
            src: "img2.jpg",
            alt: "img2",
            sources: [],
          },
          {
            type: "image",
            id: "img3",
            people: ["person-1"],
            src: "img3.jpg",
            alt: "img3",
            sources: [],
          },
        ],
      },
    ],
  };

  const faces = {
    images: {
      img1: { facesDetected: 1, faces: [], peopleIds: ["person-1"] },
      img2: { facesDetected: 1, faces: [], peopleIds: ["person-2"] },
      img3: { facesDetected: 1, faces: [], peopleIds: ["person-1"] },
    },
  };

  await fsp.writeFile(
    path.join(DATA_DIR, "people.manifest.json"),
    JSON.stringify({ people }, null, 2),
  );
  await fsp.writeFile(path.join(DATA_DIR, "images.manifest.json"), JSON.stringify(images, null, 2));
  await fsp.writeFile(path.join(DATA_DIR, "faces.manifest.json"), JSON.stringify(faces, null, 2));

  // Create dummy face files
  await fsp.mkdir(path.join(STATIC_DIR, "faces/person-1"), { recursive: true });
  await fsp.mkdir(path.join(STATIC_DIR, "faces/person-2"), { recursive: true });
  await fsp.writeFile(path.join(STATIC_DIR, "faces/person-1/img1.jpg"), "dummy-content");
  await fsp.writeFile(path.join(STATIC_DIR, "faces/person-1/img3.jpg"), "dummy-content");
  await fsp.writeFile(path.join(STATIC_DIR, "faces/person-2/img2.jpg"), "dummy-content");

  process.env.CONTENT_DIR = TEST_DIR;
}

async function cleanupEnv() {
  await fsp.rm(DATA_DIR, { recursive: true, force: true });
  await fsp.rm(STATIC_DIR, { recursive: true, force: true });
  process.env.CONTENT_DIR = originalContentDir;
}

// Helper to mock RequestEvent
const createMockEvent = (body: unknown) =>
  ({
    request: {
      json: async () => body,
    },
  }) as any;

describe("Integration: People API", () => {
  beforeEach(async () => {
    await setupEnv();
  });

  afterEach(async () => {
    await cleanupEnv();
  });

  it("RENAME should update ID, rename folder, and update constraints", async () => {
    const event = createMockEvent({ personId: "person-1", name: "Alice Newname" });
    const res = await renamePost(event);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.id).toContain("alice-newname"); // slug check
    const newId = json.id;

    // Verify folder rename
    const newIdDir = path.join(STATIC_DIR, "faces", newId);
    expect((await fsp.stat(newIdDir).catch(() => null))?.isDirectory()).toBe(true);

    expect(await fsp.stat(path.join(STATIC_DIR, "faces", "person-1")).catch(() => null)).toBeNull();

    // Verify manifest update
    const people = await Bun.file(path.join(DATA_DIR, "people.manifest.json")).json();

    const p = people.people.find((x: any) => x.id === newId);
    expect(p).toBeDefined();
    expect(p.name).toBe("Alice Newname");
    expect(p.thumbnail).toContain(newId);

    // Verify image references
    const images = await Bun.file(path.join(DATA_DIR, "images.manifest.json")).json();
    const img1 = images.photoDays[0].items.find((i: any) => i.id === "img1");
    expect(img1.people).toContain(newId);
    expect(img1.people).not.toContain("person-1");
  });

  it("MERGE should move files, update references, and empty source", async () => {
    const event = createMockEvent({ sourcePersonId: "person-2", targetPersonId: "person-1" });
    const res = await mergePost(event);
    const json = await res.json();

    expect(json.success).toBe(true);

    // Check files moved
    // person-2 had img2.jpg, should now be in person-1 folder
    expect(await Bun.file(path.join(STATIC_DIR, "faces/person-1/img2.jpg")).exists()).toBe(true);
    // source folder might still exist or file gone
    expect(await Bun.file(path.join(STATIC_DIR, "faces/person-2/img2.jpg")).exists()).toBe(false);

    // Check manifests
    const images = await Bun.file(path.join(DATA_DIR, "images.manifest.json")).json();
    const img2 = images.photoDays[0].items.find((i: any) => i.id === "img2");
    expect(img2.people).toContain("person-1");
    expect(img2.people).not.toContain("person-2");

    const people = await Bun.file(path.join(DATA_DIR, "people.manifest.json")).json();
    const p2 = people.people.find((p: any) => p.id === "person-2");
    expect(p2).toBeUndefined();
    const p1 = people.people.find((p: any) => p.id === "person-1");
    // BREAKING CHANGE DOCUMENTATION:
    // Merge operation now strictly requires file move success.
    // If fsp.rename failed, the manifest would NOT be updated and p2 would still exist.
    // This ensures consistency between filesystem and metadata.
    expect(p1.faceCount).toBe(3); // 2 original + 1 merged
  });

  it("UNMATCH should create new person, move file, and create constraint", async () => {
    const event = createMockEvent({ personId: "person-1", imageId: "img3" });
    const res = await unmatchPost(event);
    const json = await res.json();

    expect(json.success).toBe(true);
    const newPersonId = json.newPerson.id;

    // Check new person created
    expect(newPersonId).toContain("person-");
    expect(newPersonId).toContain("odpojeno-od-alice");

    // Check file moved
    expect(await Bun.file(path.join(STATIC_DIR, "faces", newPersonId, "img3.jpg")).exists()).toBe(
      true,
    );
    expect(await Bun.file(path.join(STATIC_DIR, "faces/person-1/img3.jpg")).exists()).toBe(false);

    // Check constraint file created
    const constraintsPath = path.join(DATA_DIR, "clustering-constraints.json");
    expect(await Bun.file(constraintsPath).exists()).toBe(true);
    const constraints = await Bun.file(constraintsPath).json();
    expect(constraints.disconnects).toHaveLength(1);
    expect(constraints.disconnects[0]).toEqual({ imageId: "img3", personId: "person-1" });
  });

  // Negative Tests
  it("RENAME should fail with 404 if person does not exist", async () => {
    const event = createMockEvent({ personId: "person-999", name: "Nobody" });
    const res = await renamePost(event);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/not found/i);
  });

  it("RENAME should fail with 409 if target name/ID already exists", async () => {
    // We want to verify that if the target folder for the new name already exists, we stop.
    // person-1 exists. slug for "Conflict Name" -> "conflict-name".
    // ID logic: baseId (person-1) + -- + slug -> "person-1--conflict-name".

    const conflictName = "Conflict Name";
    const conflictSlug = "conflict-name";
    const conflictId = `person-1--${conflictSlug}`;

    // Manually create the folder/conflict
    await fsp.mkdir(path.join(STATIC_DIR, "faces", conflictId), { recursive: true });

    const event = createMockEvent({ personId: "person-1", name: conflictName });
    const res = await renamePost(event);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/target folder already exists/i);
  });

  // Concurrency Smoke Test
  it("CONCURRENCY: should handle simultaneous requests gracefully", async () => {
    // We try to rename the SAME person twice with different names at the same time.
    // One should succeed, the other might fail or succeed sequentially.
    // The lock should prevent corruption.

    const eventA = createMockEvent({ personId: "person-2", name: "Bob Alpha" });
    const eventB = createMockEvent({ personId: "person-2", name: "Bob Beta" });

    const results = await Promise.allSettled([renamePost(eventA), renamePost(eventB)]);

    // We expect both to be settled.
    // Since we use a file lock, they SHOULD run sequentially.
    // So both should likely succeed (last one wins), OR one fails if state changed under its feet.
    // Ideally 200 OK for both, or 503 if lock timeout (unlikely in test).

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(2);

    // Check final state
    const people = await Bun.file(path.join(DATA_DIR, "people.manifest.json")).json();
    const p2 = people.people.find((p: any) => p.id.startsWith("person-2"));

    // One of the names should be persisted
    expect(["Bob Alpha", "Bob Beta"]).toContain(p2.name);
  });
});

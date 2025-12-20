/**
 * @fileoverview Advanced People API Integration Tests
 *
 * @description
 * Tests complex people management operations: marking as junk (deletes person),
 * reassigning faces between people, and updating person categories.
 * Verifies that constraints are recorded and manifests are synchronized.
 *
 * @modules-tested
 * - src/routes/api/people/mark-as-junk/+server.ts
 * - src/routes/api/people/reassign/+server.ts
 * - src/routes/api/people/update-category/+server.ts
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as ignorePost } from "../../src/routes/api/people/ignore/+server";
import { POST as ignoreFacePost } from "../../src/routes/api/people/ignore-face/+server";
import { POST as junkPost } from "../../src/routes/api/people/mark-as-junk/+server";
import { POST as mergePost } from "../../src/routes/api/people/merge/+server";
import { POST as reassignPost } from "../../src/routes/api/people/reassign/+server";
import { POST as renamePost } from "../../src/routes/api/people/rename/+server";
import { POST as categoryPost } from "../../src/routes/api/people/update-category/+server";

const CWD = path.resolve(__dirname, "../../");
const TEST_DIR = `test-people-adv-${Date.now()}`;
const DATA_DIR = path.resolve(CWD, "src/data", TEST_DIR);
const STATIC_DIR = path.resolve(CWD, "static", TEST_DIR);

const originalContentDir = process.env.CONTENT_DIR;

async function setupEnv() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(path.resolve(STATIC_DIR, "faces/person-1"), { recursive: true });
  await fsp.mkdir(path.resolve(STATIC_DIR, "faces/person-2"), { recursive: true });

  const people = [
    {
      id: "person-1",
      name: "Alice",
      faceCount: 2,
      thumbnail: "faces/person-1/img1.jpg",
      faceDescriptor: Array(128).fill(0.1),
    },
    {
      id: "person-2",
      name: "Bob",
      faceCount: 1,
      thumbnail: "faces/person-2/img2.jpg",
      faceDescriptor: Array(128).fill(0.8),
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
            analysis: { faces: [{ x: 1, y: 1, width: 10, height: 10 }] },
          },
          {
            type: "image",
            id: "img2",
            people: ["person-2"],
            analysis: { faces: [{ x: 2, y: 2, width: 20, height: 20 }] },
          },
          {
            type: "image",
            id: "img3",
            people: ["person-1"],
            analysis: { faces: [{ x: 3, y: 3, width: 30, height: 30 }] },
          },
        ],
      },
    ],
  };

  const faces = {
    img1: {
      facesDetected: true,
      faces: [{ x: 1, y: 1, width: 10, height: 10 }],
      peopleIds: ["person-1"],
    },
    img2: {
      facesDetected: true,
      faces: [{ x: 2, y: 2, width: 20, height: 20 }],
      peopleIds: ["person-2"],
    },
    img3: {
      facesDetected: true,
      faces: [{ x: 3, y: 3, width: 30, height: 30 }],
      peopleIds: ["person-1"],
    },
  };

  await fsp.writeFile(
    path.join(DATA_DIR, "people.manifest.json"),
    JSON.stringify({ people }, null, 2),
  );
  await fsp.writeFile(path.join(DATA_DIR, "images.manifest.json"), JSON.stringify(images, null, 2));
  await fsp.writeFile(path.join(DATA_DIR, "faces.manifest.json"), JSON.stringify(faces, null, 2));

  // Create dummy face files
  await fsp.writeFile(path.join(STATIC_DIR, "faces/person-1/img1.jpg"), "dummy-p1-img1");
  await fsp.writeFile(path.join(STATIC_DIR, "faces/person-1/img3.jpg"), "dummy-p1-img3");
  await fsp.writeFile(path.join(STATIC_DIR, "faces/person-2/img2.jpg"), "dummy-p2-img2");

  // Initial constraints
  const constraints = {
    disconnects: [{ imageId: "img5", personId: "person-1" }],
    connects: [{ imageId: "img6", personId: "person-1" }],
    ignoredCrops: [],
  };
  await fsp.writeFile(
    path.join(DATA_DIR, "clustering-constraints.json"),
    JSON.stringify(constraints, null, 2),
  );

  process.env.CONTENT_DIR = TEST_DIR;
}

async function cleanupEnv() {
  await fsp.rm(DATA_DIR, { recursive: true, force: true });
  await fsp.rm(STATIC_DIR, { recursive: true, force: true });
  process.env.CONTENT_DIR = originalContentDir;
}

const createMockEvent = (body: unknown) =>
  ({
    request: {
      json: async () => body,
    },
  }) as any;

describe("Integration: People Advanced API", () => {
  beforeEach(async () => {
    await setupEnv();
  });

  afterEach(async () => {
    await cleanupEnv();
  });

  it("REASSIGN should move face from one person to another", async () => {
    // Move img3 from Alice (person-1) to Bob (person-2)
    const event = createMockEvent({
      sourcePersonId: "person-1",
      targetPersonId: "person-2",
      imageIds: ["img3"],
    });

    const res = await reassignPost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify people weights/faceCounts
    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(people.find((p: any) => p.id === "person-1").faceCount).toBe(1);
    expect(people.find((p: any) => p.id === "person-2").faceCount).toBe(2);

    // Verify image linkage
    const images = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"),
    );
    const img3 = images.photoDays[0].items.find((i: any) => i.id === "img3");
    expect(img3.people).toContain("person-2");
    expect(img3.people).not.toContain("person-1");

    // Verify filesystem
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-2/img3.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-1/img3.jpg"))).toBe(false);
  });

  it("MARK-AS-JUNK should delete person and record ignored crops", async () => {
    // Kill Bob
    const event = createMockEvent({ personId: "person-2" });
    const res = await junkPost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify person gone
    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(people.find((p: any) => p.id === "person-2")).toBeUndefined();

    // Verify constraints recorded
    const constraints = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"),
    );
    expect(constraints.ignoredCrops).toHaveLength(1);
    expect(constraints.ignoredCrops[0].imageId).toBe("img2");

    // Verify physical folder gone
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-2"))).toBe(false);
  });

  it("UPDATE-CATEGORY should update category field", async () => {
    const event = createMockEvent({ personId: "person-1", category: "statue" });
    const res = await categoryPost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(people.find((p: any) => p.id === "person-1").category).toBe("statue");
  });

  it("IGNORE should toggle ignored flag in people manifest", async () => {
    // Toggle Alice to ignored
    const event = createMockEvent({ personId: "person-1" });
    const res = await ignorePost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(people.find((p: any) => p.id === "person-1").ignored).toBe(true);

    // Toggle back
    const res2 = await ignorePost(event);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    const people2 = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(people2.find((p: any) => p.id === "person-1").ignored).toBe(false);
  });

  it("IGNORE-FACE should remove face from person and record constraint", async () => {
    // Ignore Alice's face in img1
    const event = createMockEvent({
      personId: "person-1",
      imageId: "img1",
      box: { x: 1, y: 1, width: 10, height: 10 },
    });
    const res = await ignoreFacePost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify faceCount decreased
    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(people.find((p: any) => p.id === "person-1").faceCount).toBe(1);

    // Verify images manifest updated
    const images = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"),
    );
    const img1 = images.photoDays[0].items.find((i: any) => i.id === "img1");
    expect(img1.people).not.toContain("person-1");

    // Verify constraints recorded
    const constraints = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"),
    );
    expect(constraints.ignoredCrops).toHaveLength(1);
    expect(constraints.ignoredCrops[0].imageId).toBe("img1");

    // Verify physical file gone (simulated via setupEnv)
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-1/img1.jpg"))).toBe(false);
  });

  it("MERGE should combine two people, average descriptors, and migrate constraints", async () => {
    // Merge Alice (person-1, 2 faces, desc 0.1) into Bob (person-2, 1 face, desc 0.8)
    const event = createMockEvent({
      sourcePersonId: "person-1",
      targetPersonId: "person-2",
    });

    const res = await mergePost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    // 1. Verify descriptor averaging
    // Weighted avg: (0.1 * 2 + 0.8 * 1) / 3 = 1.0 / 3 = 0.333...
    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    const mergedBob = people.find((p: any) => p.id === "person-2");
    expect(mergedBob.faceDescriptor[0]).toBeCloseTo(0.333, 3);
    expect(mergedBob.faceCount).toBe(3);

    // 2. Verify person-1 is gone
    expect(people.find((p: any) => p.id === "person-1")).toBeUndefined();

    // 3. Verify constraint migration
    const constraints = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"),
    );
    expect(constraints.disconnects.find((c: any) => c.imageId === "img5").personId).toBe(
      "person-2",
    );
    expect(constraints.connects.find((c: any) => c.imageId === "img6").personId).toBe("person-2");

    // 4. Verify filesystem (person-1 folder should be cleaned up)
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-1"))).toBe(false);
  });

  it("RENAME should change name and ID, and update all references", async () => {
    // Rename Alice (person-1) to Alicia
    const event = createMockEvent({ personId: "person-1", name: "Alicia" });
    const res = await renamePost(event);
    const json = await res.json();
    expect(json.success).toBe(true);
    const newId = json.id;
    expect(newId).toContain("person-1--alicia");

    // 1. Verify people manifest
    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    const renamed = people.find((p: any) => p.name === "Alicia");
    expect(renamed).toBeDefined();
    expect(renamed.id).toBe(newId);
    expect(people.find((p: any) => p.id === "person-1")).toBeUndefined();

    // 2. Verify image references
    const images = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"),
    );
    const img1 = images.photoDays[0].items.find((i: any) => i.id === "img1");
    expect(img1.people).toContain(newId);
    expect(img1.people).not.toContain("person-1");

    // 3. Verify faces manifest
    const faces = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "faces.manifest.json"), "utf8"),
    );
    expect(faces.img1.peopleIds).toContain(newId);

    // 4. Verify constraints
    const constraints = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"),
    );
    expect(constraints.disconnects.find((c: any) => c.imageId === "img5").personId).toBe(newId);

    // 5. Verify filesystem rename
    expect(fs.existsSync(path.join(STATIC_DIR, "faces", newId))).toBe(true);
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-1"))).toBe(false);
  });
});

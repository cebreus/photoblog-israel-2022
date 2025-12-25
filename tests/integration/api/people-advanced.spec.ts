/**
 * @fileoverview Advanced People API Integration Tests
 *
 * @description
 * Tests complex people management operations: junk, reassign, category.
 * Verifies that constraints are recorded and manifests are synchronized.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PATCH as peoplePatch } from "../../../src/routes/api/people/+server";
import { POST as ignoreFacePost } from "../../../src/routes/api/people/invalidate-detection/+server";
import { POST as mergePost } from "../../../src/routes/api/people/merge/+server";
import { POST as reassignPost } from "../../../src/routes/api/people/reassign/+server";

const CWD = process.cwd();
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
      hidden: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "person-2",
      name: "Bob",
      faceCount: 1,
      thumbnail: "faces/person-2/img2.jpg",
      faceDescriptor: Array(128).fill(0.8),
      hidden: false,
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
    invalidDetections: [],
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

function createMockEvent(body: unknown) {
  return {
    request: {
      json: async function () {
        return body;
      },
    },
  } as any;
}

describe("Integration: People Advanced API", () => {
  beforeEach(async () => {
    await setupEnv();
  });

  afterEach(async () => {
    await cleanupEnv();
  });

  it("REASSIGN should move face from one person to another", async () => {
    const event = createMockEvent({
      sourcePersonId: "person-1",
      targetPersonId: "person-2",
      imageIds: ["img3"],
    });

    const res = await reassignPost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(
      people.find(function (p: any) {
        return p.id === "person-1";
      }).faceCount,
    ).toBe(1);
    expect(
      people.find(function (p: any) {
        return p.id === "person-2";
      }).faceCount,
    ).toBe(2);

    const images = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"),
    );
    const img3 = images.photoDays[0].items.find(function (i: any) {
      return i.id === "img3";
    });
    expect(img3.people).toContain("person-2");

    expect(await Bun.file(path.join(STATIC_DIR, "faces/person-2/img3.jpg")).exists()).toBe(true);
  });

  it("JUNK should toggle junk flag INDEPENDENTLY of hidden flag", async () => {
    // NEW behavior: junk setting does NOT automatically set hidden.
    const event = createMockEvent({ updates: [{ id: "person-2", junk: true }] });
    const res = await peoplePatch(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    const p2 = people.find(function (p: any) {
      return p.id === "person-2";
    });
    expect(p2.junk).toBe(true);
    // Should remain false because it was false initially and we didn't touch it
    expect(p2.hidden).toBe(false);

    // Verify constraints are UNTOUCHED (empty)
    const constraints = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"),
    );
    // invalidDetections should be empty because 'junk' action just flags the person
    expect(constraints.invalidDetections).toHaveLength(0);
  });

  it("UPDATE-CATEGORY should update category field", async () => {
    const event = createMockEvent({ updates: [{ id: "person-1", category: "statue" }] });
    const res = await peoplePatch(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(
      people.find(function (p: any) {
        return p.id === "person-1";
      }).category,
    ).toBe("statue");
  });

  it("HIDE should toggle hidden flag", async () => {
    const event = createMockEvent({ updates: [{ id: "person-1", hidden: true }] });
    const res = await peoplePatch(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(
      people.find(function (p: any) {
        return p.id === "person-1";
      }).hidden,
    ).toBe(true);
  });

  it("IGNORE-FACE should remove face from person and record constraint", async () => {
    const event = createMockEvent({
      personId: "person-1",
      imageId: "img1",
      box: { x: 1, y: 1, width: 10, height: 10 },
    });
    const res = await ignoreFacePost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(
      people.find(function (p: any) {
        return p.id === "person-1";
      }).faceCount,
    ).toBe(1);

    const constraints = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"),
    );
    expect(constraints.invalidDetections).toHaveLength(1);
    expect(constraints.invalidDetections[0].imageId).toBe("img1");
  });

  it("MERGE should combine people and migrate constraints", async () => {
    const event = createMockEvent({ sourcePersonId: "person-1", targetPersonId: "person-2" });
    const res = await mergePost(event);
    const json = await res.json();
    expect(json.success).toBe(true);

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    ).people;
    expect(
      people.find(function (p: any) {
        return p.id === "person-2";
      }).faceCount,
    ).toBe(3);
    expect(
      people.find(function (p: any) {
        return p.id === "person-1";
      }),
    ).toBeUndefined();

    const constraints = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"),
    );
    expect(
      constraints.disconnects.find(function (c: any) {
        return c.imageId === "img5";
      }).personId,
    ).toBe("person-2");
  });
});

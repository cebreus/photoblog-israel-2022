import fs from "node:fs";
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

describe("Integration: People API", () => {
  beforeEach(async () => {
    await setupEnv();
  });

  afterEach(async () => {
    await cleanupEnv();
  });

  it("RENAME should update ID, rename folder, and update constraints", async () => {
    const req = {
      json: async () => ({ personId: "person-1", name: "Alice Newname" }),
    };

    const res = await renamePost({ request: req } as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.id).toContain("alice-newname"); // slug check
    const newId = json.id;

    // Verify folder rename
    expect(fs.existsSync(path.join(STATIC_DIR, "faces", newId))).toBe(true);
    expect(fs.existsSync(path.join(STATIC_DIR, "faces", "person-1"))).toBe(false);

    // Verify manifest update
    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    );
    const p = people.people.find((x: any) => x.id === newId);
    expect(p).toBeDefined();
    expect(p.name).toBe("Alice Newname");
    expect(p.thumbnail).toContain(newId);

    // Verify image references
    const images = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"),
    );
    const img1 = images.photoDays[0].items.find((i: any) => i.id === "img1");
    expect(img1.people).toContain(newId);
    expect(img1.people).not.toContain("person-1");
  });

  it("MERGE should move files, update references, and empty source", async () => {
    const req = {
      json: async () => ({ sourcePersonId: "person-2", targetPersonId: "person-1" }),
    };

    const res = await mergePost({ request: req } as any);
    const json = await res.json();

    expect(json.success).toBe(true);

    // Check files moved
    // person-2 had img2.jpg, should now be in person-1 folder
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-1/img2.jpg"))).toBe(true);
    // source folder might still exist or file gone
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-2/img2.jpg"))).toBe(false);

    // Check manifests
    const images = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"),
    );
    const img2 = images.photoDays[0].items.find((i: any) => i.id === "img2");
    expect(img2.people).toContain("person-1");
    expect(img2.people).not.toContain("person-2");

    const people = JSON.parse(
      await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8"),
    );
    const p2 = people.people.find((p: any) => p.id === "person-2");
    expect(p2.faceCount).toBe(0);
    const p1 = people.people.find((p: any) => p.id === "person-1");
    expect(p1.faceCount).toBe(3); // 2 original + 1 merged
  });

  it("UNMATCH should create new person, move file, and create constraint", async () => {
    const req = {
      json: async () => ({ personId: "person-1", imageId: "img3" }),
    };

    const res = await unmatchPost({ request: req } as any);
    const json = await res.json();

    expect(json.success).toBe(true);
    const newPersonId = json.newPerson.id;

    // Check new person created
    expect(newPersonId).toContain("person-");
    expect(newPersonId).toContain("odpojeno-z-alice");

    // Check file moved
    expect(fs.existsSync(path.join(STATIC_DIR, "faces", newPersonId, "img3.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(STATIC_DIR, "faces/person-1/img3.jpg"))).toBe(false);

    // Check constraint file created
    const constraintsPath = path.join(DATA_DIR, "clustering-constraints.json");
    expect(fs.existsSync(constraintsPath)).toBe(true);
    const constraints = JSON.parse(await fsp.readFile(constraintsPath, "utf8"));
    expect(constraints.disconnects).toHaveLength(1);
    expect(constraints.disconnects[0]).toEqual({ imageId: "img3", personId: "person-1" });
  });
});

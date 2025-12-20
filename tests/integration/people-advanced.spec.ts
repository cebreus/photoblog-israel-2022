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
import { POST as junkPost } from "../../src/routes/api/people/mark-as-junk/+server";
import { POST as reassignPost } from "../../src/routes/api/people/reassign/+server";
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
        { id: "person-1", name: "Alice", faceCount: 2, thumbnail: "faces/person-1/img1.jpg" },
        { id: "person-2", name: "Bob", faceCount: 1, thumbnail: "faces/person-2/img2.jpg" },
    ];

    const images = {
        photoDays: [
            {
                date: "2025-01-01",
                id: "2025-01-01",
                items: [
                    { type: "image", id: "img1", people: ["person-1"], analysis: { faces: [{ x: 1, y: 1, width: 10, height: 10 }] } },
                    { type: "image", id: "img2", people: ["person-2"], analysis: { faces: [{ x: 2, y: 2, width: 20, height: 20 }] } },
                    { type: "image", id: "img3", people: ["person-1"], analysis: { faces: [{ x: 3, y: 3, width: 30, height: 30 }] } },
                ],
            },
        ],
    };

    const faces = {
        img1: { facesDetected: true, faces: [{ x: 1, y: 1, width: 10, height: 10 }], peopleIds: ["person-1"] },
        img2: { facesDetected: true, faces: [{ x: 2, y: 2, width: 20, height: 20 }], peopleIds: ["person-2"] },
        img3: { facesDetected: true, faces: [{ x: 3, y: 3, width: 30, height: 30 }], peopleIds: ["person-1"] },
    };

    await fsp.writeFile(path.join(DATA_DIR, "people.manifest.json"), JSON.stringify({ people }, null, 2));
    await fsp.writeFile(path.join(DATA_DIR, "images.manifest.json"), JSON.stringify(images, null, 2));
    await fsp.writeFile(path.join(DATA_DIR, "faces.manifest.json"), JSON.stringify(faces, null, 2));

    // Create dummy face files
    await fsp.writeFile(path.join(STATIC_DIR, "faces/person-1/img1.jpg"), "dummy-p1-img1");
    await fsp.writeFile(path.join(STATIC_DIR, "faces/person-1/img3.jpg"), "dummy-p1-img3");
    await fsp.writeFile(path.join(STATIC_DIR, "faces/person-2/img2.jpg"), "dummy-p2-img2");

    process.env.CONTENT_DIR = TEST_DIR;
}

async function cleanupEnv() {
    await fsp.rm(DATA_DIR, { recursive: true, force: true });
    await fsp.rm(STATIC_DIR, { recursive: true, force: true });
    process.env.CONTENT_DIR = originalContentDir;
}

const createMockEvent = (body: unknown) => ({
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
            imageIds: ["img3"]
        });

        const res = await reassignPost(event);
        const json = await res.json();
        expect(json.success).toBe(true);

        // Verify people weights/faceCounts
        const people = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8")).people;
        expect(people.find((p: any) => p.id === "person-1").faceCount).toBe(1);
        expect(people.find((p: any) => p.id === "person-2").faceCount).toBe(2);

        // Verify image linkage
        const images = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"));
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
        const people = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8")).people;
        expect(people.find((p: any) => p.id === "person-2")).toBeUndefined();

        // Verify constraints recorded
        const constraints = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "clustering-constraints.json"), "utf8"));
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

        const people = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "people.manifest.json"), "utf8")).people;
        expect(people.find((p: any) => p.id === "person-1").category).toBe("statue");
    });
});

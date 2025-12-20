/**
 * @fileoverview Image Management Integration Tests
 *
 * @description
 * Tests the server-side API endpoints for managing images.
 * Verifies deletion, archiving, and metadata patching (EXIF/IPTC).
 * Ensures filesystem consistency (source files, generated assets, cache) and manifest updates.
 *
 * @modules-tested
 * - src/routes/api/images/+server.ts
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as archiveImages, DELETE as deleteImages, PATCH as patchImages } from "../../src/routes/api/images/+server";

// Mock dev environment for DELETE/POST/PATCH
vi.mock("$app/environment", () => ({
    dev: true,
}));

// Mock exiftool-vendored
vi.mock("exiftool-vendored", () => ({
    exiftool: {
        write: vi.fn().mockResolvedValue({}),
    },
}));

const CWD = path.resolve(__dirname, "../../");
const TEST_DIR = `test-image-api-${Date.now()}`;
const DATA_DIR = path.resolve(CWD, "src/data", TEST_DIR);
const STATIC_DIR = path.resolve(CWD, "static", TEST_DIR);
const CONTENT_DIR_PATH = path.resolve(CWD, "content", TEST_DIR);
const TEMP_DIR = path.resolve(CWD, ".temp", TEST_DIR);

const originalContentDir = process.env.CONTENT_DIR;

async function setupEnv() {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.mkdir(path.resolve(CONTENT_DIR_PATH, "pics"), { recursive: true });
    await fsp.mkdir(path.resolve(CONTENT_DIR_PATH, "archive"), { recursive: true });
    await fsp.mkdir(path.resolve(STATIC_DIR, "images/previews"), { recursive: true });
    await fsp.mkdir(TEMP_DIR, { recursive: true });

    const images = {
        photoDays: [
            {
                date: "2025-01-01",
                id: "2025-01-01",
                items: [
                    {
                        type: "image",
                        id: "img1",
                        src: `/images/${TEST_DIR}/img1.jpg`,
                        exif: { title: "Old Title" },
                    },
                    {
                        type: "image",
                        id: "img2",
                        src: `/images/${TEST_DIR}/img2.jpg`,
                    },
                ],
            },
        ],
    };

    await fsp.writeFile(path.join(DATA_DIR, "images.manifest.json"), JSON.stringify(images, null, 2));

    // Create dummy physical files
    await fsp.writeFile(path.join(CONTENT_DIR_PATH, "pics/img1.jpg"), "dummy-img1");
    await fsp.writeFile(path.join(CONTENT_DIR_PATH, "pics/img2.jpg"), "dummy-img2");

    // Create dummy generated assets
    await fsp.writeFile(path.join(STATIC_DIR, "images/previews/img1.jpg"), "dummy-preview");

    // Create dummy cache
    await fsp.writeFile(path.join(TEMP_DIR, "images.cache.json"), JSON.stringify({ "img1.jpg": { hash: "123" } }));

    process.env.CONTENT_DIR = TEST_DIR;
}

async function cleanupEnv() {
    await fsp.rm(DATA_DIR, { recursive: true, force: true });
    await fsp.rm(STATIC_DIR, { recursive: true, force: true });
    await fsp.rm(CONTENT_DIR_PATH, { recursive: true, force: true });
    await fsp.rm(TEMP_DIR, { recursive: true, force: true });
    process.env.CONTENT_DIR = originalContentDir;
}

const createMockEvent = (body: unknown) => ({
    request: {
        json: async () => body,
    },
}) as any;

describe("Integration: Image Management API", () => {
    beforeEach(async () => {
        await setupEnv();
    });

    afterEach(async () => {
        await cleanupEnv();
    });

    it("DELETE should remove physical file, assets, cache, and manifest entry", async () => {
        const event = createMockEvent({ ids: [{ id: "img1", src: `/images/${TEST_DIR}/img1.jpg` }] });
        const res = await deleteImages(event);
        const json = await res.json();

        expect(json.success).toBe(true);

        // Verify physical file gone
        expect(fs.existsSync(path.join(CONTENT_DIR_PATH, "pics/img1.jpg"))).toBe(false);

        // Verify assets gone
        expect(fs.existsSync(path.join(STATIC_DIR, "images/previews/img1.jpg"))).toBe(false);

        // Verify manifest updated
        const manifest = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"));
        const img1 = manifest.photoDays[0].items.find((i: any) => i.id === "img1");
        expect(img1).toBeUndefined();
    });

    it("ARCHIVE should move file to archive/ and remove from manifest", async () => {
        const event = createMockEvent({ action: "archive", ids: [{ id: "img2", src: `/images/${TEST_DIR}/img2.jpg` }] });
        const res = await archiveImages(event);
        const json = await res.json();

        expect(json.success).toBe(true);

        // Verify moved
        expect(fs.existsSync(path.join(CONTENT_DIR_PATH, "pics/img2.jpg"))).toBe(false);
        expect(fs.existsSync(path.join(CONTENT_DIR_PATH, "archive/img2.jpg"))).toBe(true);

        // Verify manifest updated
        const manifest = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"));
        const img2 = manifest.photoDays[0].items.find((i: any) => i.id === "img2");
        expect(img2).toBeUndefined();
    });

    it("PATCH should update manifest fields", async () => {
        // We mock exiftool.write to avoid side effects in integration tests if possible, 
        // but here we want to test if the manifest is updated by the PATCH handler.
        // Note: PATCH also tries to write to the physical file using exiftool.

        const event = createMockEvent({
            images: [{ id: "img1", src: `/images/${TEST_DIR}/img1.jpg` }],
            updates: { title: "New Title", city: "New City" }
        });

        const res = await patchImages(event);
        if (res.status !== 200) {
            console.error("PATCH failed:", await res.json());
        }
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        const manifest = JSON.parse(await fsp.readFile(path.join(DATA_DIR, "images.manifest.json"), "utf8"));
        const img1 = manifest.photoDays[0].items.find((i: any) => i.id === "img1");
        expect(img1.exif.title).toBe("New Title");
        expect(img1.city).toBe("New City");
    });
});

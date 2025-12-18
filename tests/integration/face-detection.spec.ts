import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { detectFaces, initModels } from "../../scripts/lib/face-detection";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const SAMPLE_IMAGE_PATH = path.join(FIXTURES_DIR, "obama.jpg");
// Public domain image
const SAMPLE_IMAGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/President_Barack_Obama.jpg/480px-President_Barack_Obama.jpg";

describe("Face Detection Integration", () => {
  beforeAll(async () => {
    // Ensure fixtures dir
    if (!fs.existsSync(FIXTURES_DIR)) {
      await fsp.mkdir(FIXTURES_DIR, { recursive: true });
    }

    // Download sample image if missing
    if (!fs.existsSync(SAMPLE_IMAGE_PATH)) {
      console.log("Downloading sample image for test...");
      const res = await fetch(SAMPLE_IMAGE_URL);
      if (!res.ok) throw new Error("Failed to download sample image");
      const buffer = await res.arrayBuffer();
      await fsp.writeFile(SAMPLE_IMAGE_PATH, Buffer.from(buffer));
    }

    // Initialize models (this downloads them if missing to scripts/models)
    // Increase timeout because download might take time
    await initModels();
  }, 60000); // 60s timeout for setup

  it("should detect at least one face in the sample image", async () => {
    const faces = await detectFaces(SAMPLE_IMAGE_PATH);
    console.log("Detected faces:", faces);

    expect(faces).toBeDefined();
    expect(faces.length).toBeGreaterThan(0);

    const face = faces[0];
    expect(face.width).toBeGreaterThan(0);
    expect(face.height).toBeGreaterThan(0);
  }, 30000);
});

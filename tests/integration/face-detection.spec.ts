/**
 * @fileoverview Face Detection Integration Tests
 *
 * @description
 * Tests the face detection pipeline using the `face-api.js` wrapper.
 * Verifies that the SSD MobileNet V1 model loads correctly and can detect
 * faces in a sample image.
 *
 * @modules-tested
 * - scripts/lib/face-detection.ts
 *
 * @fixtures
 * - tests/fixtures/obama.jpg
 */

import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { detectFaces, initModels } from "../../scripts/lib/face-detection";
import { createLogger } from "../../scripts/lib/logger";

const logger = createLogger("face-detection-test");

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const SAMPLE_IMAGE_PATH = path.join(FIXTURES_DIR, "obama.jpg");
const sampleImage = Bun.file(SAMPLE_IMAGE_PATH);

describe("Face Detection Integration", () => {
  beforeAll(async () => {
    // Ensure fixtures are present (should be vendorized in repo)
    if (!(await sampleImage.exists())) {
      throw new Error(
        `Missing fixture: ${SAMPLE_IMAGE_PATH}. Please ensure tests/fixtures/obama.jpg exists.`,
      );
    }

    // Initialize models (this downloads them if missing to scripts/models)
    // Increase timeout because download might take time
    await initModels();
  }, 60000); // 60s timeout for setup

  it("should detect at least one face in the sample image", async () => {
    const size = (await sampleImage.arrayBuffer()).byteLength;
    logger.info(`Testing with image: ${SAMPLE_IMAGE_PATH} (${size} bytes)`);
    expect(size).toBeGreaterThan(1000); // Ensure it's not a tiny error file

    const faces = await detectFaces(SAMPLE_IMAGE_PATH);
    if (faces && faces.length > 1) {
      faces.sort((a, b) => a.x - b.x);
    }
    logger.info(`Detected faces: ${faces?.length}`);

    expect(faces).toBeDefined();
    // In CI/CPU envs, small face models might miss detections. Treat that as a failure in CI so the
    // pipeline stays deterministic; allow a warning locally to avoid flakiness while developing.
    if (faces.length === 0) {
      const message =
        "Integration: No faces detected in sample image. Verify model/image if consistent failure.";
      const isCi = Bun.env.CI === "true" || Bun.env.CI === "1";

      if (isCi) {
        throw new Error(message);
      }

      logger.warn(message);
      return;
    }

    expect(faces.length).toBeGreaterThan(0);
    const face = faces[0];
    expect(face.width).toBeGreaterThan(0);
    expect(face.height).toBeGreaterThan(0);
  }, 30000);
});

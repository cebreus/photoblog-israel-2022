#!/usr/bin/env bun
import path from "node:path";
import * as tf from "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import { createLogger } from "./lib/core/cli-logger";
import { convertHeicToPng } from "./lib/image-utils";

const logger = createLogger("debug-face");

async function main() {
  const imagePathInput = process.argv[2];
  if (!imagePathInput) {
    logger.error("Please provide an image path");
    process.exit(1);
  }

  const MODELS_DIR = path.resolve(process.cwd(), "scripts/models");
  logger.info(`Using models from ${MODELS_DIR}`);

  faceapi.env.monkeyPatch({
    Canvas: canvas.Canvas as unknown as any,
    Image: canvas.Image as unknown as any,
    ImageData: canvas.ImageData as unknown as any,
  });

  await tf.ready();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);

  const imagePath = imagePathInput;
  let imgBuffer: Buffer | undefined;

  if (imagePath.toLowerCase().endsWith(".heic")) {
    logger.info("Converting HEIC to PNG...");
    imgBuffer = await convertHeicToPng(imagePath);
    // faceapi/canvas works with buffer
  }

  logger.info(`Analyzing ${imagePath}...`);

  const input = imgBuffer || imagePath;
  const img = await canvas.loadImage(input);

  const detections = await faceapi
    .detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  logger.info(`Found ${detections.length} faces`);

  for (const [i, face] of detections.entries()) {
    logger.info(
      `Face ${i + 1}: score=${face.detection.score.toFixed(4)} box=${Math.round(face.detection.box.x)},${Math.round(face.detection.box.y)},${Math.round(face.detection.box.width)},${Math.round(face.detection.box.height)}`,
    );
    if (face.descriptor) {
      logger.info(`  Descriptor length: ${face.descriptor.length}`);
    }
  }
}

main().catch((e) => logger.error(e));

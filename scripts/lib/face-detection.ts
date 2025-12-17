import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createLogger } from "./logger";

const logger = createLogger("face-api");

const MODELS_DIR = path.resolve(process.cwd(), "scripts/models");
const BASE_MODEL_URL = "https://raw.githubusercontent.com/vladmandic/face-api/master/model";

// We use SSD MobileNet V1 for higher accuracy over Tiny Face Detector
const MODEL_NAME = "ssd_mobilenetv1";

/**
 * Load and prepare face detection models and runtime dependencies.
 */
export async function initModels() {
  // Lazy import to avoid loading TensorFlow/canvas at module load time
  const faceapi = await import("@vladmandic/face-api");
  const tf = await import("@tensorflow/tfjs-node");
  const { Canvas, Image, ImageData } = await import("canvas");

  // Patch the environment for Node.js
  faceapi.env.monkeyPatch({
    Canvas: Canvas as any,
    Image: Image as any,
    ImageData: ImageData as any,
  });
  logger.info("Initializing TensorFlow/FaceAPI...");
  await tf.ready();

  if (!fs.existsSync(MODELS_DIR)) {
    await fsp.mkdir(MODELS_DIR, { recursive: true });
  }

  // Check if model files exist, if not download them
  // We accept that we might need to download them once
  try {
    // Attempt to load from disk first
    // Note: loadFromDisk expects the directory containing the model files
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
    logger.info("Face models loaded from disk.");
  } catch (error) {
    logger.warn("Could not load models from disk. Attempting download...");
    await downloadModelFiles();
    // Try loading again
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
    logger.info("Face models downloaded and loaded.");
  }

  logger.info(`SSD Model Loaded: ${faceapi.nets.ssdMobilenetv1.isLoaded}`);
  logger.info(`TF Backend: ${tf.getBackend()}`);

  // Set options for detection
  // minConfidence: 0.5 is default, maybe tweak?
}

/**
 * Download the model manifest and its shard files into the local models directory.
 */
async function downloadModelFiles() {
  const manifestFile = `${MODEL_NAME}_model-weights_manifest.json`;

  // 1. Download Manifest
  await downloadFile(manifestFile);

  // 2. Parse Manifest to find shards
  const manifestPath = path.join(MODELS_DIR, manifestFile);
  const manifestContent = await fsp.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestContent);

  // 3. Download Shards
  // Manifest format: [{ paths: ["shard1"], ... }]
  const downloadPromises: Promise<void>[] = [];
  if (Array.isArray(manifest)) {
    for (const entry of manifest) {
      if (entry.paths) {
        for (const shardName of entry.paths) {
          downloadPromises.push(downloadFile(shardName));
        }
      }
    }
  }
  await Promise.all(downloadPromises);
}
/**
 * Download a model file from the remote repository to the local models directory if missing.
 */
async function downloadFile(filename: string) {
  const destPath = path.join(MODELS_DIR, filename);
  if (fs.existsSync(destPath)) return;

  const url = `${BASE_MODEL_URL}/${filename}`;
  logger.info(`Downloading model file: ${filename}...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  await fsp.writeFile(destPath, Buffer.from(arrayBuffer));
}

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
/**
 * Detect faces in an image and return bounding boxes.
 */
export async function detectFaces(input: string | Buffer): Promise<FaceBox[]> {
  try {
    // Lazy import to avoid loading at module load time
    const faceapi = await import("@vladmandic/face-api");
    const { loadImage } = await import("canvas");

    // Load image using canvas
    const img = await loadImage(input);
    logger.verbose(`Loaded image: ${img.width}x${img.height}`);

    // Detect
    const detections = await faceapi.detectAllFaces(
      img as any,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    );

    return detections.map((d) => ({
      x: d.box.x,
      y: d.box.y,
      width: d.box.width,
      height: d.box.height,
    }));
  } catch (err) {
    logger.error(`Face detection failed: ${err}`);
    return [];
  }
}

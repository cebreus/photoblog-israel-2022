import fsp from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../core/cli-logger";

const logger = createLogger("face-api");

const MODELS_DIR = path.resolve(process.cwd(), "scripts/models");
const BASE_MODEL_URL = "https://raw.githubusercontent.com/vladmandic/face-api/master/model";

const MODEL_NAME = "ssd_mobilenetv1";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function initModels() {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const faceapi = await import("@vladmandic/face-api");
    const tf = await import("@tensorflow/tfjs-node");
    const { Canvas, Image, ImageData } = await import("canvas");

    faceapi.env.monkeyPatch({
      Canvas: Canvas as unknown as typeof globalThis.HTMLCanvasElement,
      Image: Image as unknown as typeof globalThis.HTMLImageElement,
      ImageData: ImageData as unknown as typeof globalThis.ImageData,
    });
    logger.info("Initializing TensorFlow/FaceAPI...");
    await tf.ready();

    try {
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
      logger.info("Face models loaded from disk.");
    } catch (_error) {
      logger.warn("Could not load models from disk. Attempting download...");
      await downloadModelFiles();
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
      logger.info("Face models downloaded and loaded.");
    }

    logger.info(`SSD Model Loaded: ${faceapi.nets.ssdMobilenetv1.isLoaded}`);
    logger.info(`TF Backend: ${tf.getBackend()}`);
    modelsLoaded = true;
  })();

  return loadingPromise;
}

async function downloadModelFiles() {
  const manifestFile = `${MODEL_NAME}_model-weights_manifest.json`;

  await downloadFile(manifestFile);

  const manifestPath = path.join(MODELS_DIR, manifestFile);
  const manifestContent = await fsp.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestContent);

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

async function downloadFile(filename: string) {
  const destPath = path.join(MODELS_DIR, filename);

  const exists = await fsp
    .access(destPath)
    .then(() => true)
    .catch(() => false);

  if (exists) return;

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

export async function detectFaces(input: string | Buffer): Promise<FaceBox[]> {
  await initModels();
  try {
    const faceapi = await import("@vladmandic/face-api");
    const { loadImage } = await import("canvas");

    const img = await loadImage(input);
    logger.verbose(`Loaded image: ${img.width}x${img.height}`);

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

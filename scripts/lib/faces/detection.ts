import path from "node:path";
import { createLogger } from "$scripts/core/cli-logger";
import { fileExists, readFileText, writeFile } from "$scripts/utils/runtime";

const logger = createLogger("face-api");

const MODELS_DIR = path.resolve(process.cwd(), "scripts/models");
const BASE_MODEL_URL = "https://raw.githubusercontent.com/vladmandic/face-api/master/model";

const MODEL_NAME = "ssd_mobilenetv1";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;
let faceapi: typeof import("@vladmandic/face-api") | null = null;
let loadImage: typeof import("canvas").loadImage | null = null;

export async function initModels() {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    faceapi = await import("@vladmandic/face-api");
    const tf = await import("@tensorflow/tfjs-node");
    const canvas = await import("canvas");
    loadImage = canvas.loadImage;
    const { Canvas, Image, ImageData } = canvas;

    faceapi.env.monkeyPatch({
      Canvas: Canvas as unknown as typeof globalThis.HTMLCanvasElement,
      Image: Image as unknown as typeof globalThis.HTMLImageElement,
      ImageData: ImageData as unknown as typeof globalThis.ImageData,
    });
    logger.info({}, "Initializing TensorFlow/FaceAPI...");
    await tf.ready();

    try {
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
      logger.info({ modelsDir: MODELS_DIR }, "Face models loaded from disk.");
    } catch (_error) {
      logger.warn({}, "Could not load models from disk. Attempting download...");
      await downloadModelFiles();
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
      logger.info({}, "Face models downloaded and loaded.");
    }

    logger.info(
      {
        ssdLoaded: faceapi.nets.ssdMobilenetv1.isLoaded,
        backend: tf.getBackend(),
      },
      "FaceAPI Init Complete",
    );
    modelsLoaded = true;
  })();

  return loadingPromise;
}

async function downloadModelFiles() {
  const manifestFile = `${MODEL_NAME}_model-weights_manifest.json`;

  await downloadFile(manifestFile);

  const manifestPath = path.join(MODELS_DIR, manifestFile);
  const manifestContent = await readFileText(manifestPath);
  const manifest = JSON.parse(manifestContent);

  if (!Array.isArray(manifest)) return;

  const downloadPromises = manifest
    .flatMap((entry: any) => entry.paths || [])
    .map((shardName: string) => downloadFile(shardName));

  await Promise.all(downloadPromises);
}

async function downloadFile(filename: string) {
  const destPath = path.join(MODELS_DIR, filename);

  const exists = await fileExists(destPath);

  if (exists) return;

  const url = `${BASE_MODEL_URL}/${filename}`;
  logger.info({ filename }, "Downloading model file...");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  await writeFile(destPath, Buffer.from(arrayBuffer));
}

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function detectFaces(input: string | Buffer): Promise<FaceBox[]> {
  await initModels();
  if (!faceapi || !loadImage) throw new Error("FaceAPI not initialized");

  try {
    const img = await loadImage(input);
    logger.debug({ width: img.width, height: img.height }, "Loaded image");

    const detections = await faceapi.detectAllFaces(
      img as any,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    );

    return detections.map((detection) => ({
      x: detection.box.x,
      y: detection.box.y,
      width: detection.box.width,
      height: detection.box.height,
    }));
  } catch (err) {
    logger.error({ err }, "Face detection failed");
    return [];
  }
}

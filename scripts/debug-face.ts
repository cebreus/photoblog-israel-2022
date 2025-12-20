
import path from "node:path";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import { convertHeicToPng } from "./lib/image-utils";
import { createLogger } from "./lib/logger";

const logger = createLogger("debug-face");

const SCRIPT_DIR = import.meta.dir;

const FACE_CONFIG = {
  minConfidence: 0.1,
  modelPath: path.resolve(SCRIPT_DIR, "models"), // Point to the local models directory
};

faceapi.env.monkeyPatch({
  Canvas: canvas.Canvas,
  Image: canvas.Image,
  ImageData: canvas.ImageData,
});

async function _run() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_CONFIG.modelPath);

  // Hardcoded path to IMG_8056
  const imagePath = "content/egypt-2025/pics/IMG_8056.HEIC";
  logger.info(`Processing ${imagePath}...`);

  let _imgBuffer: Buffer;
  if (imagePath.toLowerCase().endsWith(".heic")) {
    _imgBuffer = await convertHeicToPng(imagePath);
  } else {
    const logger = createLogger("debug-face");

    async function main() {
      const imagePath = process.argv[2];
      if (!imagePath) {
        logger.error("Please provide an image path");
        process.exit(1);
      }

      logger.info(`Analyzing ${imagePath}...`);

      const detector = new FaceDetector();
      await detector.init();

      const faces = await detector.detect(imagePath);
      logger.info(`Found ${faces.length} faces`);

      for (const [i, face] of faces.entries()) {
        logger.info(`Face ${i + 1}: score=${face.score.toFixed(4)} box=${face.box.map((n) => Math.round(n))}`);
        if (face.descriptor) {
          logger.info(`  Descriptor length: ${face.descriptor.length}`);
        }
      }
    }

    main().catch((e) => logger.error(e));

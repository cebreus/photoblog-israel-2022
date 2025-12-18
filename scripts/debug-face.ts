import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import fsp from "node:fs/promises";
import path from "node:path";
import { convertHeicToPng } from "./lib/image-utils";

const FACE_CONFIG = {
  minConfidence: 0.1,
  modelPath: path.resolve(process.cwd(), "node_modules/@vladmandic/face-api/model"),
};

faceapi.env.monkeyPatch({
  Canvas: canvas.Canvas,
  Image: canvas.Image,
  ImageData: canvas.ImageData,
});

async function run() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_CONFIG.modelPath);

  // Hardcoded path to IMG_8056
  const imagePath = "content/egypt-2025/pics/IMG_8056.HEIC";
  console.log(`Processing ${imagePath}...`);

  let imgBuffer: Buffer;
  if (imagePath.toLowerCase().endsWith(".heic")) {
    imgBuffer = await convertHeicToPng(imagePath);
  } else {
    imgBuffer = await fsp.readFile(imagePath);
  }

  const img = await canvas.loadImage(imgBuffer);
  console.log(`Image size: ${img.width}x${img.height}`);

  const detections = await faceapi.detectAllFaces(
    img as any,
    new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_CONFIG.minConfidence }),
  );

  console.log(`Found ${detections.length} faces (minConfidence: ${FACE_CONFIG.minConfidence})`);

  detections.forEach((d, i) => {
    console.log(
      `Face ${i + 1}: Score ${d.score.toFixed(3)}, Box: ${Math.round(d.box.width)}x${Math.round(d.box.height)} at ${Math.round(d.box.x)},${Math.round(d.box.y)}`,
    );
  });
}

(async () => {
  try {
    await run();
  } catch (error) {
    console.error(error);
  }
})();

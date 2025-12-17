import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";

const FACE_CONFIG = {
  minConfidence: 0.1, // NÍZKÝ PRÁH PRO DEBUG
  modelPath: path.resolve(process.cwd(), "node_modules/@vladmandic/face-api/model"),
};

// @ts-ignore
faceapi.env.monkeyPatch({
  Canvas: canvas.Canvas,
  Image: canvas.Image,
  ImageData: canvas.ImageData,
});

/**
 * Converts a HEIC image file to a PNG image buffer.
 */
async function convertHeicToPng(inputPath: string): Promise<Buffer> {
  const tempFile = path.resolve(process.cwd(), ".temp-debug", path.basename(inputPath) + ".png");
  await fsp.mkdir(path.dirname(tempFile), { recursive: true });

  return new Promise<Buffer>((resolve, reject) => {
    const p = spawn("sips", ["-s", "format", "png", inputPath, "--out", tempFile]);
    p.on("close", async (code) => {
      if (code === 0) {
        try {
          const buf = await fsp.readFile(tempFile);
          await fsp.unlink(tempFile); // clean up
          resolve(buf);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`sips process exited with code ${code}`));
      }
    });
  });
}

/**
 * Detects faces in a hardcoded image file and logs the results.
 */
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

run().catch(console.error);

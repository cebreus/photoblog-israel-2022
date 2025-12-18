import { intro, select } from "@clack/prompts";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { ImageEntry, PeopleManifest, Person } from "../src/lib/types/manifest";
import {
  loadImagesManifest,
  loadPeopleManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "./lib/manifest-repository";

const FACE_CONFIG = {
  minConfidence: 0.5,
  modelPath: path.resolve(process.cwd(), "node_modules/@vladmandic/face-api/model"),
  distanceThreshold: 0.5,
  facesDir: "faces",
};

// Initialize face-api for Node environment
faceapi.env.monkeyPatch({
  Canvas: canvas.Canvas,
  Image: canvas.Image,
  ImageData: canvas.ImageData,
});

/**
 * Calculates the Euclidean distance between two face descriptors.
 */
function euclideanDistance(desc1: number[], desc2: number[]): number {
  return faceapi.euclideanDistance(desc1, desc2);
}

/**
 * Converts a HEIC image file to a PNG image buffer.
 */
async function convertHeicToPng(inputPath: string): Promise<Buffer> {
  const tempFile = path.resolve(process.cwd(), ".temp", path.basename(inputPath) + ".png");
  await ensureDir(path.dirname(tempFile));

  return new Promise<Buffer>((resolve, reject) => {
    const p = spawn("sips", ["-s", "format", "png", inputPath, "--out", tempFile]);
    p.on("close", async (code) => {
      if (code === 0) {
        try {
          const buf = await fsp.readFile(tempFile);
          await fsp.unlink(tempFile);
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
 * Ensures that a directory exists, creating it if necessary.
 */
async function ensureDir(dir: string) {
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch (e) {
    // ignore exist error
  }
}

/**
 * Loads the face detection, landmark, and recognition models from disk.
 */
async function loadModels() {
  console.log(`Loading models from ${FACE_CONFIG.modelPath}...`);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_CONFIG.modelPath);
}

/**
 * Loads and prepares an image for face detection, handling HEIC conversion and rotation.
 */
async function prepareImageForFaceDetection(imagePath: string): Promise<any> {
  let imgBuffer: Buffer;
  if (imagePath.toLowerCase().endsWith(".heic")) {
    imgBuffer = await convertHeicToPng(imagePath);
  } else {
    imgBuffer = await sharp(imagePath).rotate().png().toBuffer();
  }
  return await canvas.loadImage(imgBuffer);
}

/**
 * Extracts and saves a padded face crop from an image to a specified directory.
 */
async function saveFaceCrop(
  img: any, // Canvas.Image
  box: { x: number; y: number; width: number; height: number },
  personId: string,
  imageId: string,
  facesOutputDir: string,
) {
  const { x, y, width, height } = box;
  const pad = 0.2; // 20%
  const cropX = Math.max(0, x - width * pad);
  const cropY = Math.max(0, y - height * pad);
  const cropW = Math.min(img.width - cropX, width * (1 + 2 * pad));
  const cropH = Math.min(img.height - cropY, height * (1 + 2 * pad));

  const cropCanvas = canvas.createCanvas(cropW, cropH);
  const ctx = cropCanvas.getContext("2d");
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const buffer = cropCanvas.toBuffer("image/jpeg");

  // Save to person's folder
  const personDir = path.resolve(facesOutputDir, personId);
  await ensureDir(personDir);
  const cropPath = path.resolve(personDir, `${imageId}.jpg`);
  await fsp.writeFile(cropPath, buffer);

  return buffer;
}

/**
 * Finds the best matching person for a given face descriptor from a list of people.
 */
function findBestMatch(
  descriptor: number[],
  people: Person[],
  constraints: Set<string>,
  imageId: string,
): Person | null {
  const candidates = people
    .map((person) => ({
      person,
      dist: euclideanDistance(descriptor, person.faceDescriptor),
    }))
    .filter((c) => c.dist < FACE_CONFIG.distanceThreshold)
    .sort((a, b) => a.dist - b.dist);

  for (const candidate of candidates) {
    const { person } = candidate;
    if (person.ignored) continue;

    if (constraints.has(`${imageId}:${person.id}`)) {
      continue;
    }

    return person;
  }
  return null;
}

/**
 * Processes face detections for an image, matching them to existing people or creating new ones.
 */
async function processFaceDetections(
  img: any,
  detections: any[],
  image: ImageEntry,
  people: Person[],
  disconnectedPairs: Set<string>,
  facesOutputDir: string,
) {
  for (const detection of detections) {
    const descriptor = Array.from(detection.descriptor) as number[];
    if (descriptor.length !== 128) {
      console.warn(`Skipping detection with invalid descriptor length: ${descriptor.length}`);
      continue;
    }
    const bestMatch = findBestMatch(descriptor, people, disconnectedPairs, image.id);

    if (bestMatch) {
      bestMatch.faceCount++;
      if (!image.people) image.people = [];
      if (!image.people.includes(bestMatch.id)) {
        image.people.push(bestMatch.id);
      }

      await saveFaceCrop(img, detection.detection.box, bestMatch.id, image.id, facesOutputDir);

      if (!bestMatch.thumbnail || bestMatch.thumbnail.startsWith("faces/person-")) {
        bestMatch.thumbnail = `faces/${bestMatch.id}/${image.id}.jpg`;
      }

      for (let k = 0; k < 128; k++) {
        bestMatch.faceDescriptor[k] =
          (bestMatch.faceDescriptor[k] * (bestMatch.faceCount - 1) + descriptor[k]) /
          bestMatch.faceCount;
      }
    } else {
      const uuid = crypto.randomUUID().slice(0, 8);
      const personId = `person-${uuid}`;
      await saveFaceCrop(img, detection.detection.box, personId, image.id, facesOutputDir);

      const thumbPath = `faces/${personId}/${image.id}.jpg`;
      const newPerson: Person = {
        id: personId,
        name: `Person ${people.length + 1}`,
        faceDescriptor: descriptor,
        faceCount: 1,
        thumbnail: thumbPath,
        ignored: false,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      people.push(newPerson);

      if (!image.people) image.people = [];
      if (!image.people.includes(personId)) {
        image.people.push(personId);
      }
    }
  }
}

/**
 * Runs the face clustering process on all images in the content directory.
 */
async function main() {
  intro("🤖 Face Clustering");

  let contentDir = process.env.CONTENT_DIR;
  if (!contentDir) {
    const contentDirRoot = path.resolve("content");
    const entries = await fsp.readdir(contentDirRoot, { withFileTypes: true });
    const galleries = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    if (galleries.length === 0) {
      console.error("No galleries found");
      process.exit(1);
    }

    if (galleries.length === 1) {
      contentDir = galleries[0];
    } else {
      const galleryId = await select({
        message: "Select a gallery to cluster faces:",
        options: galleries.map((g) => ({ value: g, label: g })),
      });
      if (typeof galleryId !== "string") process.exit(0);
      contentDir = galleryId;
    }
  }

  console.log(`Running Face Clustering for: ${contentDir}`);

  // Paths
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const facesOutputDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);
  const sourceDir = path.resolve(process.cwd(), `content/${contentDir}/pics`);

  await ensureDir(facesOutputDir);

  // Load manifest via Repository
  const manifest = await loadImagesManifest(dataDir);
  if (!manifest) {
    console.error(`Manifest not found in ${dataDir}`);
    process.exit(1);
  }

  // Load models
  await loadModels();

  // Load existing people manifest if exists via Repository
  let people: Person[] = [];
  const existingPeopleManifest = await loadPeopleManifest(dataDir);
  if (existingPeopleManifest && Array.isArray(existingPeopleManifest.people)) {
    people = existingPeopleManifest.people;
    console.log(`Loaded ${people.length} existing people from manifest.`);

    // Validate descriptors
    const validPeople = people.filter((p) => p.faceDescriptor && p.faceDescriptor.length === 128);
    if (validPeople.length < people.length) {
      console.warn(
        `Warning: Filtered out ${people.length - validPeople.length} people with invalid face descriptors.`,
      );
      people = validPeople;
    }
  } else {
    console.log("No existing people manifest found, starting fresh.");
  }

  // Load constraints
  const constraintsPath = path.resolve(dataDir, "clustering-constraints.json");
  const disconnectedPairs = new Set<string>();
  try {
    const cData = await fsp.readFile(constraintsPath, "utf-8");
    const constraints = JSON.parse(cData);
    if (constraints.disconnects && Array.isArray(constraints.disconnects)) {
      constraints.disconnects.forEach((c: any) => {
        disconnectedPairs.add(`${c.imageId}:${c.personId}`);
      });
    }
    console.log(`Loaded ${disconnectedPairs.size} disconnection constraints.`);
  } catch (e) {
    console.log("No constraints found or invalid file.");
  }

  const allImages: ImageEntry[] = [];
  manifest.photoDays.forEach((day) => {
    day.items.forEach((item) => {
      if (item.type === "image") {
        const img = item as ImageEntry;
        // Reset people array to ensure clean re-clustering
        // (Old detections must be cleared to specificy 404s for faces that are no longer matched)
        img.people = [];
        allImages.push(img);
      }
    });
  });

  console.log(`Processing ${allImages.length} images...`);

  let processedCount = 0;

  for (const image of allImages) {
    processedCount++;
    const imagePath = path.resolve(sourceDir, image.src);

    try {
      await fsp.access(imagePath);
    } catch {
      console.warn(`Image file not found: ${imagePath}`);
      continue;
    }

    let img: any;
    try {
      img = await prepareImageForFaceDetection(imagePath);
    } catch (e) {
      console.error(`Failed to process image ${imagePath}:`, e);
      continue;
    }

    // Detect faces
    const detections = await faceapi
      .detectAllFaces(
        img as any,
        new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_CONFIG.minConfidence }),
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length > 0) {
      console.log(`  Found ${detections.length} faces in ${image.id}`);
    }

    await processFaceDetections(img, detections, image, people, disconnectedPairs, facesOutputDir);

    if (processedCount % 10 === 0) {
      process.stdout.write(
        `\rProcessed ${processedCount}/${allImages.length} images... Found ${people.length} people.`,
      );
    }
  }

  console.log(`\nFinished. Found ${people.length} unique people.`);

  // Sort people by count
  people.sort((a, b) => b.faceCount - a.faceCount);

  // Rename generic persons only
  people.forEach((p, index) => {
    if (p.name.startsWith("Person ")) {
      // Logic for automatic renaming if desired, currently commented out in original
    }
  });

  const output: PeopleManifest = { people };

  // Save updated images.manifest.json with people data
  console.log(`Saving updated images manifest with people data...`);
  // Preserve desired key order in analysis: aestheticScore first when present
  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.analysis) {
        const a: any = item.analysis as any;
        if (typeof a.aestheticScore !== "undefined") {
          const { aestheticScore, ...rest } = a;
          item.analysis = { aestheticScore, ...rest } as any;
        }
      }
    }
  }

  // Use Repository for saving
  await saveImagesManifest(dataDir, manifest);
  console.log(`Updated manifest saved to ${dataDir}/images.manifest.json`);

  await savePeopleManifest(dataDir, output);
  console.log(`Saved people manifest to ${dataDir}/people.manifest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

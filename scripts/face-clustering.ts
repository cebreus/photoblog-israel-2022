import { intro, outro } from "@clack/prompts";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import crypto from "crypto";
import fsp from "fs/promises";

import path from "path";
import sharp from "sharp";
import type { FacesManifest, ImageEntry, Person } from "../src/lib/types/manifest";
import { isValidClusteringConstraints } from "../src/lib/utils/manifest-validators";
import { parseCliArguments } from "./lib/cli-parser";
import { deleteOldFaceCrops, findBestMatch, saveFaceCrop } from "./lib/clustering-utils";
import { getConcurrency } from "./lib/concurrency-utils";
import { resolveGalleryDirectory } from "./lib/gallery-resolver";
import { convertHeicToPng, ensureDir } from "./lib/image-utils";
import { createLogger } from "./lib/logger";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "./lib/manifest-repository";
import { filterPeopleWithValidDescriptors } from "./lib/people-utils";
import { progressManager } from "./lib/progress-manager";
import { formatDuration } from "./lib/time-utils";

const SCRIPT_DIR = import.meta.dir;
const logger = createLogger("face-clustering");

const options = parseCliArguments(process.argv.slice(2));
const values = options; // For compatibility with existing 'values' references

const FACE_CONFIG = {
  minConfidence: values.minConfidence,
  modelPath: path.resolve(SCRIPT_DIR, "models"), // Point to the local models directory
  distanceThreshold: values.threshold,
  facesDir: "faces",
};

// Initialize face-api for Node environment
faceapi.env.monkeyPatch({
  Canvas: canvas.Canvas as unknown as typeof globalThis.HTMLCanvasElement,
  Image: canvas.Image as unknown as typeof globalThis.HTMLImageElement,
  ImageData: canvas.ImageData as unknown as typeof globalThis.ImageData,
});

async function loadModels() {
  logger.info(`Loading models from ${FACE_CONFIG.modelPath}...`);
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_CONFIG.modelPath);
}

async function prepareImageForFaceDetection(imagePath: string, detailsDir: string): Promise<any> {
  const baseName = path.basename(imagePath);
  const fileNameWithoutExt = baseName.replace(/\.[^/.]+$/, "");

  // Try to find the thumbnail in the 'details' folder (optimized for 1280px)
  const thumbnailPath = path.join(detailsDir, `${fileNameWithoutExt}.jpeg`);

  let imgBuffer: Buffer;
  try {
    await fsp.access(thumbnailPath);
    if (values.verbose) logger.verbose(`Using thumbnail for face detection: ${thumbnailPath}`);
    imgBuffer = await fsp.readFile(thumbnailPath);
  } catch {
    // Fallback to original if thumbnail is missing
    if (imagePath.toLowerCase().endsWith(".heic")) {
      imgBuffer = await convertHeicToPng(imagePath);
    } else {
      imgBuffer = await sharp(imagePath).rotate().png().toBuffer();
    }
  }
  return await canvas.loadImage(imgBuffer);
}

const DISTANCE_THRESHOLD = FACE_CONFIG.distanceThreshold;

async function processFaceDetections(
  img: any,
  detections: any[],
  image: ImageEntry,
  people: Person[],
  disconnectedPairs: Set<string>,
  ignoredPairs: Set<string>,
  facesOutputDir: string,
) {
  if (!image.analysis) {
    image.analysis = {
      sharpness: 0,
      phash: "",
      embedding: [],
      facesDetected: false,
    };
  }
  image.analysis.faces = [];
  image.analysis.facesDetected = true;

  const scaleX = (image.width || img.width) / img.width;
  const scaleY = (image.height || img.height) / img.height;

  for (const detection of detections) {
    const box = detection.detection.box;
    image.analysis.faces.push({
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    });

    const descriptor = Array.from(detection.descriptor) as number[];
    if (descriptor.length !== 128) {
      if (values.verbose)
        logger.warn(`Skipping detection with invalid descriptor length: ${descriptor.length}`);
      continue;
    }

    // Check if this crop is marked as ignored (junk)
    const isIgnored = [...ignoredPairs].some((p) => {
      const [imgId, x, y, w, h] = p.split(":");
      if (imgId !== image.id) return false;

      // Check for significant overlap with ignored box
      const box = detection.detection.box;
      const ix = Number.parseFloat(x);
      const iy = Number.parseFloat(y);
      const iw = Number.parseFloat(w);
      const ih = Number.parseFloat(h);

      const overlapX = Math.max(0, Math.min(box.x + box.width, ix + iw) - Math.max(box.x, ix));
      const overlapY = Math.max(0, Math.min(box.y + box.height, iy + ih) - Math.max(box.y, iy));
      const overlapArea = overlapX * overlapY;
      const boxArea = box.width * box.height;
      const ignoredArea = iw * ih;

      // If more than 80% overlap with an ignored crop, skip it
      return overlapArea / Math.min(boxArea, ignoredArea) > 0.8;
    });

    if (isIgnored) {
      if (values.verbose) logger.verbose(`Skipping ignored (junk) crop in ${image.id}`);
      continue;
    }

    const bestMatch = findBestMatch(
      descriptor,
      people,
      disconnectedPairs,
      image.id,
      DISTANCE_THRESHOLD,
    );

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
      // Check for minimum face size before creating a new person
      // This prevents creating thousands of "Person X" for tiny background faces
      if (values.minFaceSize > 0) {
        const minSize = values.minFaceSize;
        if (box.width < minSize || box.height < minSize) {
          if (values.verbose) {
            logger.verbose(
              `Skipping new person creation for small face (${Math.round(box.width)}x${Math.round(box.height)}) in ${image.id}`,
            );
          }
          return; // Skip creation
        }
      }

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

async function loadClusteringResources(dataDir: string): Promise<{
  people: Person[];
  disconnectedPairs: Set<string>;
  ignoredPairs: Set<string>;
  manualConnects: Map<string, string[]>;
}> {
  let people: Person[] = [];
  const existingPeopleManifest = await loadPeopleManifest(dataDir);
  if (existingPeopleManifest?.people) {
    people = filterPeopleWithValidDescriptors(existingPeopleManifest.people);
    if (values.verbose) logger.info(`Loaded ${people.length} existing people from manifest.`);
  }

  const disconnectedPairs = new Set<string>();
  const ignoredPairs = new Set<string>();
  const manualConnects = new Map<string, string[]>();
  const constraintsPath = path.resolve(dataDir, "clustering-constraints.json");

  try {
    const cData = await fsp.readFile(constraintsPath, "utf-8");
    const parsed = JSON.parse(cData);

    if (isValidClusteringConstraints(parsed)) {
      for (const c of parsed.disconnects) {
        disconnectedPairs.add(`${c.imageId}:${c.personId}`);
      }
      for (const c of parsed.connects) {
        if (!manualConnects.has(c.imageId)) {
          manualConnects.set(c.imageId, []);
        }
        manualConnects.get(c.imageId)?.push(c.personId);
      }
      if (parsed.ignoredCrops) {
        for (const c of parsed.ignoredCrops) {
          ignoredPairs.add(`${c.imageId}:${c.box.x}:${c.box.y}:${c.box.width}:${c.box.height}`);
        }
      }
      if (values.verbose)
        logger.info(
          `Loaded ${disconnectedPairs.size} disconnects, ${manualConnects.size} connects, and ${ignoredPairs.size} ignored crops.`,
        );
    }
  } catch {
    if (values.verbose) logger.info("No constraints found or invalid file.");
  }

  return { people, disconnectedPairs, ignoredPairs, manualConnects };
}

function prepareImageQueues(
  manifest: any,
  manualConnects: Map<string, string[]>,
): { image: ImageEntry; oldPeople: string[] }[] {
  const queue: { image: ImageEntry; oldPeople: string[] }[] = [];

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const img = item as ImageEntry;
        const manualIds = manualConnects.get(img.id) || [];
        const oldPeople = img.people || [];
        img.people = [...manualIds];
        queue.push({ image: img, oldPeople });
      }
    }
  }

  return queue;
}

async function processImageQueue(
  queue: { image: ImageEntry; oldPeople: string[] }[],
  people: Person[],
  disconnectedPairs: Set<string>,
  ignoredPairs: Set<string>,
  facesOutputDir: string,
  sourceDir: string,
  detailsDir: string,
  facesManifest: FacesManifest, // Added
) {
  let processedCount = 0;
  const CONCURRENCY = getConcurrency(values.concurrency);

  const bar = progressManager.createBar(queue.length, "[face-clustering]", { people: 0 });

  // bar?.start(queue.length, 0, { people: 0 });

  const worker = async (item: { image: ImageEntry; oldPeople: string[] }) => {
    const { image, oldPeople } = item;

    if (oldPeople.length > 0) {
      await deleteOldFaceCrops(image.id, oldPeople, facesOutputDir);
    }

    const imagePath = path.resolve(sourceDir, image.src);
    try {
      await fsp.access(imagePath);
    } catch {
      logger.warn(`Image file not found: ${imagePath}`);
      return;
    }

    let img: any;
    try {
      img = await prepareImageForFaceDetection(imagePath, detailsDir);
    } catch (e) {
      logger.error(`Failed to process image ${imagePath}:`, e);
      return;
    }

    try {
      let detections: any[] = [];
      let usedCache = false;

      // 1. Try to load from cache
      if (facesManifest[image.id] && facesManifest[image.id].descriptors) {
        const cached = facesManifest[image.id];
        if (
          cached.faces &&
          cached.descriptors &&
          cached.faces.length === cached.descriptors.length
        ) {
          usedCache = true;
          // Reconstruct detection objects expected by processFaceDetections
          // We need to un-scale the boxes back to detection coordinates if they were scaled?
          // Wait, manifest stores relative/logical coordinates?
          // No, processFaceDetections scales them: x = box.x * scaleX.
          // The manifest stores what image.analysis.faces stores.
          // image.analysis.faces stores SCALED coordinates (relative to full image size).
          // But detection.detection.box is usually in the coordinate system of the INPUT image (thumbnail).

          // Actually, let's look at how facesManifest is saved.
          // It is saved from img.analysis.faces.
          // img.analysis.faces are computed as: box.x * scaleX (where scaleX maps thumb -> full).

          // If we reuse cache, we need to be careful.
          // If we rely on facesManifest.faces, those are ALREADY scaled to full image.
          // But processFaceDetections expects raw detection boxes (relative to the thumb `img`).

          // Easier approach: Store RAW detection boxes in facesManifest too?
          // Or just map back if we know the scales?

          // Let's assume we use the cached descriptors and faces directly.
          // But processFaceDetections does cropping!
          // saveFaceCrop(img, box...) takes `img` (thumbnail) and `box` (coords in thumbnail).

          // If facesManifest has scaled coords, we need to unscale them to crop from thumbnail.
          // scaleX = image.width / img.width.
          // So box_thumb = box_full / scaleX.

          const scaleX = (image.width || img.width) / img.width;
          const scaleY = (image.height || img.height) / img.height;

          detections = cached.faces.map((face, i) => ({
            detection: {
              box: {
                x: face.x / scaleX,
                y: face.y / scaleY,
                width: face.width / scaleX,
                height: face.height / scaleY,
              },
            },
            descriptor: new Float32Array(cached.descriptors![i]),
          }));

          if (values.verbose) logger.verbose(`Using cached descriptors for ${image.id}`);
        }
      }

      if (!usedCache) {
        try {
          detections = await faceapi
            .detectAllFaces(
              img as unknown as faceapi.TNetInput,
              new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_CONFIG.minConfidence }),
            )
            .withFaceLandmarks()
            .withFaceDescriptors();

          // Save to manifest for next time
          if (detections.length > 0) {
            // We need to calculate the scaled faces to save to manifest,
            // but processFaceDetections does that too.
            // Let's let processFaceDetections populate image.analysis,
            // and then we extract and save to facesManifest.
          }
        } catch (e) {
          logger.error(`Detection failed for ${image.id}:`, e);
        }
      }

      if (detections.length > 0) {
        if (values.verbose && !usedCache) {
          logger.verbose(`Found ${detections.length} faces in ${image.id}`);
        }

        await processFaceDetections(
          img,
          detections,
          image,
          people,
          disconnectedPairs,
          ignoredPairs,
          facesOutputDir,
        );

        // Updates facesManifest with the results (newly verified/computed)
        // Note: processFaceDetections updates image.analysis.faces
        // We need to sync that to facesManifest along with descriptors
        if (!usedCache && image.analysis && image.analysis.facesDetected) {
          facesManifest[image.id] = {
            facesDetected: true,
            faces: image.analysis.faces || [],
            peopleIds: image.people || [],
            descriptors: detections.map((d) => Array.from(d.descriptor) as number[]),
          };
        }
      } else if (!usedCache) {
        // Mark as processed but no faces
        facesManifest[image.id] = {
          facesDetected: false,
          faces: [],
          peopleIds: [],
          descriptors: [],
        };
      }
    } catch (e) {
      logger.error(`Clustering failed for ${image.id}:`, e);
    }

    processedCount++;

    if (bar) {
      bar.update(processedCount, { people: people.length });
    }
  };

  const pool: Promise<void>[] = [];
  let index = 0;

  const runNext = async () => {
    while (index < queue.length) {
      const current = queue[index++];
      if (!current) break;
      await worker(current);
    }
  };

  for (let i = 0; i < CONCURRENCY; i++) {
    pool.push(runNext());
  }

  await Promise.all(pool);
  if (bar) progressManager.removeBar(bar);
}

async function main() {
  intro("🤖 Face Clustering");

  const contentDir = await resolveGalleryDirectory();
  if (values.verbose) logger.info(`Running Face Clustering for: ${contentDir}`);

  // Paths
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const facesOutputDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);
  const sourceDir = path.resolve(process.cwd(), `content/${contentDir}/pics`);
  const detailsDir = path.resolve(process.cwd(), `static/${contentDir}/images/details`);

  await ensureDir(facesOutputDir);

  // Load manifests via Repository
  const manifest = await loadImagesManifest(dataDir);
  const facesManifest: FacesManifest = (await loadFacesManifest(dataDir)) || {};

  if (!manifest) {
    logger.error(`Manifest not found in ${dataDir}`);
    process.exit(1);
  }

  await loadModels();

  const { people, disconnectedPairs, ignoredPairs, manualConnects } =
    await loadClusteringResources(dataDir);

  if (values.clean) {
    if (values.verbose) logger.info(`Cleaning output directory: ${facesOutputDir}`);
    await fsp.rm(facesOutputDir, { recursive: true, force: true });
  }

  await ensureDir(facesOutputDir);

  if (values.manifestOnly) {
    logger.info("Manifest-only mode: Skipping face detection and clustering.");
    return;
  }

  let queue = prepareImageQueues(manifest, manualConnects);

  // Apply limit if specified
  const limit = values.limit ? Number.parseInt(String(values.limit), 10) : 0;
  if (limit > 0 && limit < queue.length) {
    if (values.verbose) logger.info(`Limiting processing to first ${limit} images.`);
    queue = queue.slice(0, limit);
  }

  logger.info(`Processing ${queue.length} images...`);

  await processImageQueue(
    queue,
    people,
    disconnectedPairs,
    ignoredPairs,
    facesOutputDir,
    sourceDir,
    detailsDir,
    facesManifest,
  );

  logger.info(`Finished. Found ${people.length} unique people.`);

  // Sort people by count
  people.sort((a, b) => b.faceCount - a.faceCount);

  // Save via Repository
  await saveImagesManifest(dataDir, manifest);

  // Update faces manifest peopleIds from current clustering state
  // We don't want to overwrite the descriptors we carefully cached/loaded!
  // processImageQueue execution pipeline now ensures facesManifest is kept up to date
  // with descriptors for new images, and we just need to sync the peopleIds
  // which might have changed due to clustering (e.g. merging/new people).

  // Actually, processFaceDetections updates `image.people`.
  // We should update facesManifest[img.id].peopleIds from img.people.
  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const img = item;
        if (facesManifest[img.id]) {
          facesManifest[img.id].peopleIds = img.people || [];
          // Ensure faces match what is in analysis if we re-clustered?
          // Yes, analysis.faces is accurate from processFaceDetections.
        }
      }
    }
  }
  await saveFacesManifest(dataDir, facesManifest);

  await savePeopleManifest(dataDir, { people });
  // logger.info(`Saved people manifest.`);

  outro("Done");
}

(async () => {
  const startTime = performance.now();
  try {
    await main();
    logger.info(`Total time: ${formatDuration(performance.now() - startTime)}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

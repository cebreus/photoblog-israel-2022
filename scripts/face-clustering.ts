import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import sharp from "sharp";
import {
  type FacesManifest,
  type ImageEntry,
  isImageEntry,
  type Person,
} from "../src/lib/types/manifest";
import { isValidClusteringConstraints } from "../src/lib/utils/manifest-validators";
import { getConcurrency } from "./lib/concurrency-utils";
import { createLogger } from "./lib/core/cli-logger";
import { parseCliArguments } from "./lib/core/cli-parser";
import { deleteOldFaceCrops, findBestMatch, saveFaceCrop } from "./lib/faces/clustering";
import { filterPeopleWithValidDescriptors, hasValidFaceDescriptor } from "./lib/faces/people";
import { resolveGalleryDirectory } from "./lib/gallery/resolver";
import { convertHeicToPng, ensureDir } from "./lib/image-utils";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "./lib/manifests/repository";
import { createBar, stopAllBars } from "./lib/progress-manager";

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
  const relativeModelPath = path.relative(process.cwd(), FACE_CONFIG.modelPath);
  logger.info(`Loading face models from "${relativeModelPath}"`);

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(FACE_CONFIG.modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_CONFIG.modelPath);
  logger.info("Face models loaded.");
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
  junkPairs: Set<string>,
  facesOutputDir: string,
  manualConnects?: Map<string, string[]>,
) {
  if (!image.analysis) {
    image.analysis = {
      sharpness: 0,
      phash: "",
      facesDetected: false,
    };
  }

  const analysis = image.analysis;
  analysis.faces = [];
  analysis.facesDetected = true;

  const scaleX = (image.width || img.width) / img.width;
  const scaleY = (image.height || img.height) / img.height;

  // Get manual people for this image
  const manualPeopleIds = manualConnects?.get(image.id) || [];

  for (const detection of detections) {
    const box = detection.detection.box;
    const scaledBox = {
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    };

    analysis.faces.push(scaledBox);

    const descriptor = Array.from(detection.descriptor) as number[];
    if (descriptor.length !== 128) {
      if (values.verbose)
        logger.warn(`Skipping detection with invalid descriptor length: ${descriptor.length}`);
      continue;
    }

    // Check if this crop is marked as junk
    const isJunk = [...junkPairs].some((p) => {
      const [imgId, x, y, w, h] = p.split(":");
      if (imgId !== image.id) return false;

      // Check for significant overlap with junk box
      // Coordinates in junkPairs are in full image space (scaled)
      const ix = Number.parseFloat(x);
      const iy = Number.parseFloat(y);
      const iw = Number.parseFloat(w);
      const ih = Number.parseFloat(h);

      const overlapX = Math.max(
        0,
        Math.min(scaledBox.x + scaledBox.width, ix + iw) - Math.max(scaledBox.x, ix),
      );
      const overlapY = Math.max(
        0,
        Math.min(scaledBox.y + scaledBox.height, iy + ih) - Math.max(scaledBox.y, iy),
      );
      const overlapArea = overlapX * overlapY;
      const boxArea = scaledBox.width * scaledBox.height;
      const junkArea = iw * ih;

      // If more than 80% overlap with a junk crop, skip it
      return overlapArea / Math.min(boxArea, junkArea) > 0.8;
    });

    if (isJunk) {
      if (values.verbose) logger.verbose(`Skipping junk crop in ${image.id}`);
      continue;
    }

    let bestMatch: Person | null = null;

    // Priority Check: Manual Connections
    // If we have manual people for this image, check if any of them is a perfect/excellent match
    if (manualPeopleIds.length > 0) {
      for (const pid of manualPeopleIds) {
        const p = people.find((pp) => pp.id === pid);
        if (p) {
          // Determine distance
          let dist = 1.0;
          if (p.faceDescriptor && p.faceDescriptor.length > 0) {
            dist = faceapi.euclideanDistance(descriptor, p.faceDescriptor);
          } else if (p.clusters && p.clusters.length > 0) {
            // check clusters
            // ... reuse clustering-utils logic but inline for now or access helper?
            // Just checking faceDescriptor which we rescued is enough?
            // If we rescued via descriptor, faceDescriptor is set.
          }

          // If distance is explicitly very low (e.g. < 0.1), it's likely the same face (e.g. from cache)
          // Normal threshold is 0.6. We want to be strict to avoid assigning wrong face in group photo.
          if (dist < 0.25) {
            // 0.25 is very close for 128D
            bestMatch = p;
            // logger.info(`Using manual connection for ${p.name} in ${image.id}`);
            break;
          }
        }
      }
    }

    if (!bestMatch) {
      bestMatch = findBestMatch(
        descriptor,
        people,
        disconnectedPairs,
        image.id,
        DISTANCE_THRESHOLD,
      );
    }

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

      // Multi-Cluster Update Logic
      const CLUSTER_MERGE_THRESHOLD = 0.25; // Heuristic: if closer than this, merge. Else new cluster.

      let bestClusterIndex = -1;
      let minClusterDist = 1.0;

      if (bestMatch.clusters && bestMatch.clusters.length > 0) {
        bestMatch.clusters.forEach((c, idx) => {
          const d = faceapi.euclideanDistance(c.centroid, descriptor);
          if (d < minClusterDist) {
            minClusterDist = d;
            bestClusterIndex = idx;
          }
        });
      } else {
        // Should have been migrated on load, but safe fallback
        bestMatch.clusters = [];
        // Use legacy descriptor if available to bootstrap
        if (bestMatch.faceDescriptor && bestMatch.faceDescriptor.length > 0) {
          bestMatch.clusters.push({
            centroid: [...bestMatch.faceDescriptor],
            faceCount: bestMatch.faceCount,
            lastSeen: bestMatch.lastSeenAt,
          });
          bestClusterIndex = 0;
          minClusterDist = faceapi.euclideanDistance(bestMatch.faceDescriptor, descriptor);
        }
      }

      // Helper to extract year
      const getYear = (img: ImageEntry): number | undefined => {
        if (img.date) {
          const y = new Date(img.date).getFullYear();
          if (!Number.isNaN(y)) return y;
        }
        if (img.exif?.date) {
          const y = new Date(img.exif.date).getFullYear();
          if (!Number.isNaN(y)) return y;
        }
        // Fallback: Image ID usually starts with YYYY (e.g. 2025-11-21...)
        const match = img.id.match(/^(\d{4})/);
        return match ? parseInt(match[1], 10) : undefined;
      };

      const currentYear = getYear(image);

      if (bestClusterIndex >= 0 && minClusterDist < CLUSTER_MERGE_THRESHOLD) {
        // Update existing cluster
        const cluster = bestMatch.clusters[bestClusterIndex];
        cluster.faceCount++;
        cluster.lastSeen = new Date().toISOString();
        // Update year if not set
        if (!cluster.year && currentYear) cluster.year = currentYear;

        // Weighted average update
        for (let k = 0; k < 128; k++) {
          cluster.centroid[k] =
            (cluster.centroid[k] * (cluster.faceCount - 1) + descriptor[k]) / cluster.faceCount;
        }
      } else {
        // Create NEW cluster for this person (Time-Series evolution)
        bestMatch.clusters.push({
          centroid: descriptor,
          faceCount: 1,
          lastSeen: new Date().toISOString(),
          year: currentYear,
        });
      }

      // Update legacy descriptors for backward compatibility (using just the first cluster or closest?)
      // Let's keep faceDescriptor as the *most recent* or *primary* centroid to avoid breaking other tools?
      // Or just ignore it. Previous simple average logic:
      // bestMatch.faceDescriptor = ... (averaged global).
      // We stop updating the global average to prevent drift. We treat 'faceDescriptor' as legacy.
      if (bestMatch.clusters.length > 0) {
        bestMatch.faceDescriptor = bestMatch.clusters[0].centroid; // Sync for legacy readers
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
        hidden: false,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        clusters: [
          {
            centroid: descriptor,
            faceCount: 1,
            lastSeen: new Date().toISOString(),
            year: (() => {
              // Extract year inline for new person scope
              if (image.date) {
                const y = new Date(image.date).getFullYear();
                if (!Number.isNaN(y)) return y;
              }
              if (image.exif?.date) {
                const y = new Date(image.exif.date).getFullYear();
                if (!Number.isNaN(y)) return y;
              }
              const match = image.id.match(/^(\d{4})/);
              return match ? parseInt(match[1], 10) : undefined;
            })(),
          },
        ],
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
  junkPairs: Set<string>;
  manualConnects: Map<string, string[]>;
}> {
  const disconnectedPairs = new Set<string>();
  const junkPairs = new Set<string>();
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
      if (parsed.invalidDetections) {
        for (const c of parsed.invalidDetections) {
          junkPairs.add(`${c.imageId}:${c.box.x}:${c.box.y}:${c.box.width}:${c.box.height}`);
        }
      }
      if (values.verbose)
        logger.info(
          `Loaded ${disconnectedPairs.size} disconnects, ${manualConnects.size} connects, and ${junkPairs.size} junk crops.`, // Renamed from ignoredPairs.size and "ignored crops"
        );
    }
  } catch {
    if (values.verbose) logger.info("No constraints found or invalid file.");
  }

  let people: Person[] = [];
  const existingPeopleManifest = await loadPeopleManifest(dataDir);
  if (existingPeopleManifest?.people) {
    people = existingPeopleManifest.people;

    // Rescue/Repair: Check for people with missing descriptors but valid thumbnails OR manifest entries
    let _rescuedCount = 0;

    // Load facesManifest for descriptor rescue optimization
    const loadedFacesManifest = (await loadFacesManifest(dataDir)) || {};

    for (const p of people) {
      if (!filterPeopleWithValidDescriptors([p]).length) {
        let rescued = false;

        // Strategy 1: Rescue from facesManifest (Preferred, no I/O needed)
        if (!rescued && loadedFacesManifest) {
          let foundImageId: string | undefined;

          // Try to find an image ID associated with this person
          // 1. Check manual connects
          for (const [imgId, pIds] of manualConnects.entries()) {
            if (pIds.includes(p.id)) {
              foundImageId = imgId;
              break;
            }
          }

          // 2. Check thumbnail path string
          if (!foundImageId && p.thumbnail) {
            const match = p.thumbnail.match(/([^/]+)\.(jpg|jpeg|png|webp)$/);
            if (match) foundImageId = match[1];
          }

          if (foundImageId && loadedFacesManifest[foundImageId]) {
            const fm = loadedFacesManifest[foundImageId];
            // fm.peopleIds might contain the person ID.
            const idx = fm.peopleIds.indexOf(p.id);
            if (idx !== -1 && fm.descriptors && fm.descriptors[idx]) {
              const d = fm.descriptors[idx];
              if (d.length === 128) {
                p.faceDescriptor = d;
                p.clusters = [
                  {
                    centroid: d,
                    faceCount: 1,
                    lastSeen: p.lastSeenAt,
                    year: new Date().getFullYear(),
                  },
                ];
                rescued = true;
                _rescuedCount++;
                logger.info(
                  `✅ Rescued ${p.name} using cached descriptor from image ${foundImageId}`,
                );
              }
            }
          }
        }

        // Strategy 2: Rescue from Thumbnail File (Fallback)
        if (!rescued && p.thumbnail && p.thumbnail !== "") {
          const thumbPath = path.resolve(
            process.cwd(),
            `static/${process.env.CONTENT_DIR}`,
            p.thumbnail,
          );
          try {
            const exists = await fsp
              .stat(thumbPath)
              .then(() => true)
              .catch(() => false);
            if (exists) {
              logger.warn(
                `Rescuing person without descriptor: ${p.name} (${p.id}). Calculating from thumbnail...`,
              );
              const imgBuffer = await fsp.readFile(thumbPath);
              const img = await canvas.loadImage(imgBuffer);

              // Detect with single face constraint since it's a crop
              const detections = await faceapi
                .detectAllFaces(
                  img as unknown as faceapi.TNetInput,
                  new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_CONFIG.minConfidence }),
                )
                .withFaceLandmarks()
                .withFaceDescriptors();

              if (detections.length > 0) {
                // Sort by size to get the main face if multiple detected (unlikely in crop but possible)
                const best = detections.sort(
                  (a, b) =>
                    b.detection.box.width * b.detection.box.height -
                    a.detection.box.width * a.detection.box.height,
                )[0];
                const descriptor = Array.from(best.descriptor) as number[];

                p.faceDescriptor = descriptor;
                p.clusters = [
                  {
                    centroid: descriptor,
                    faceCount: 1,
                    lastSeen: p.lastSeenAt,
                    year: new Date().getFullYear(),
                  },
                ];
                _rescuedCount++;
                rescued = true;
                logger.info(`✅ Rescued ${p.name} (thumbnail calculation)`);
              }
            }
          } catch (e) {
            logger.warn(`Failed to rescue ${p.name}: ${(e as Error).message}`);
          }
        }

        if (!rescued) {
          logger.warn(
            `❌ Could not rescue ${p.name}. Kept in manifest without descriptor (manual mode only).`,
          );
          p.clusters = [];
        }
      }
    }

    // Now filter again, but allow those we couldn't rescue IF they are needed for manual connects?
    // Actually, filterPeopleWithValidDescriptors removes them.
    // If we want manual connections to work for people *without* descriptors (purely manual people),
    // we must NOT simple filter them out.
    // We should keep them in the `people` array, but `findBestMatch` will ignore them naturally if they have no clusters/descriptor.
    // BUT `prepareImageQueues` needs them in `peopleIds` set.

    // Instead of filtering, let's keep ALL people, but handle empty descriptors downstream?
    // findBestMatch iterates people. If p.faceDescriptor/clusters is empty, distance calc fails or returns infinity?
    // Let's modify filter? No, let's just NOT filter them out here, but ensure they don't break downstream.

    // We will ONLY filter people who have NO valid descriptor AND NO thumbnail AND seem genuinely broken.
    // If they have a valid ID (manual entries), we want to keep them.
    // Actually, `filterPeopleWithValidDescriptors` is too aggressive.

    // Let's replace the strict filter with a logic that keeps them if they seem manual.
    // But for now, the "Rescuing" logic above fixes the "Odpojeno" people because they HAVE thumbnails.
    // So if rescue succeeds, `hasValidFaceDescriptor` will return true!

    // What if rescue fails (e.g. no face detected in crop)?
    // We should probably still keep them if they are manual targets.

    people = people.filter((p) => {
      const valid = hasValidFaceDescriptor(p);
      if (valid) return true;

      // Keep if it looks like a manual entry (has thumbnail and ID)
      if (p.id && p.thumbnail) return true;

      return false;
    });

    // Migration: Ensure 'clusters' exists
    let migratedCount = 0;
    for (const p of people) {
      if (!p.clusters || p.clusters.length === 0) {
        if (p.faceDescriptor && p.faceDescriptor.length > 0) {
          p.clusters = [
            {
              centroid: [...p.faceDescriptor],
              faceCount: p.faceCount,
              lastSeen: p.lastSeenAt,
              year: undefined, // Cannot infer year from old average, assumes generic
            },
          ];
          migratedCount++;
        } else {
          p.clusters = [];
        }
      }
    }
    if (migratedCount > 0) {
      logger.info(`Migrated ${migratedCount} people to multi-cluster schema.`);
    }

    if (values.verbose) logger.info(`Loaded ${people.length} existing people from manifest.`);
  }

  return { people, disconnectedPairs, junkPairs, manualConnects };
}

function prepareImageQueues(
  manifest: any,
  manualConnects: Map<string, string[]>,
  people: Person[],
  disconnectedPairs: Set<string>,
): { image: ImageEntry; oldPeople: string[] }[] {
  const queue: { image: ImageEntry; oldPeople: string[] }[] = [];
  const peopleIds = new Set(people.map((p) => p.id));

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (isImageEntry(item)) {
        const manualIds = manualConnects.get(item.id) || [];
        const validManualIds = manualIds.filter((id) => {
          if (peopleIds.has(id)) return true;
          return false;
        });

        const oldPeople = item.people || [];

        // CRITICAL FIX: Preserve existing people that are still valid AND not disconnected
        // This prevents loss of GUI-assigned people during re-clustering
        const preservedPeople = oldPeople.filter((personId) => {
          // Person must still exist in the manifest
          if (!peopleIds.has(personId)) return false;
          // Person must NOT be explicitly disconnected from this image
          if (disconnectedPairs.has(`${item.id}:${personId}`)) return false;
          return true;
        });

        // Combine: manualConnects have priority, then preserved existing assignments
        const combined = [...validManualIds];
        for (const pid of preservedPeople) {
          if (!combined.includes(pid)) {
            combined.push(pid);
          }
        }

        item.people = combined;
        queue.push({ image: item, oldPeople });
      }
    }
  }

  return queue;
}

async function processImageQueue(
  queue: { image: ImageEntry; oldPeople: string[] }[],
  people: Person[],
  disconnectedPairs: Set<string>,
  junkPairs: Set<string>, // Renamed from ignoredPairs
  facesOutputDir: string,
  sourceDir: string,
  detailsDir: string,
  facesManifest: FacesManifest,
  manualConnects: Map<string, string[]>,
) {
  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;
  let cachedCount = 0;
  const CONCURRENCY = getConcurrency(values.concurrency);

  const bar = createBar(queue.length, "[face-clustering]", {
    suffix: "| people: 0",
  });
  bar.start(queue.length, 0, { suffix: "| people: 0" }); // Explicitly start the bar

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
            descriptor: new Float32Array(cached.descriptors?.[i] || []),
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
          junkPairs,
          facesOutputDir,
          manualConnects,
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
      if (usedCache) {
        cachedCount++;
      } else {
        successCount++;
      }
    } catch (e) {
      failCount++;
      logger.error(`Clustering failed for ${image.id}:`, e);
    }

    processedCount++;

    if (bar) {
      bar.update(processedCount, {
        suffix: `| People: ${people.length} | Processed: ${successCount} | Cached: ${cachedCount} | Failed: ${failCount}`,
      });
    }

    // Unblock event loop to allow progress bar updates
    await new Promise((resolve) => setTimeout(resolve, 0));
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
  bar.stop();
  stopAllBars();
}

async function main() {
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

  const { people, disconnectedPairs, junkPairs, manualConnects } =
    await loadClusteringResources(dataDir);

  if (values.clean) {
    if (values.verbose) logger.info(`[CLEAN] Cleaning output directory: ${facesOutputDir}`);
    await fsp.rm(facesOutputDir, { recursive: true, force: true });

    // Reset person statistics but preserve Identity Clusters (Multi-Cluster Seed)
    logger.info("[CLEAN] Resetting person statistics while preserving identity centroids.");
    for (const p of people) {
      p.faceCount = 0;
      p.thumbnail = ""; // Will be regenerated by first match
      if (p.clusters) {
        for (const c of p.clusters) {
          // Reset weight of historical clusters to avoid double-counting infinite inflation
          // But keep them strong enough to attract matches.
          c.faceCount = 1;
        }
      }
    }

    // Mark images for re-processing
    for (const day of manifest.photoDays) {
      for (const item of day.items) {
        if (isImageEntry(item)) {
          if (item.analysis) {
            item.analysis.facesDetected = false;
            item.analysis.faces = [];
          }
        }
      }
    }
  }

  await ensureDir(facesOutputDir);

  if (values.manifestOnly) {
    logger.info("Manifest-only mode: Skipping face detection and clustering.");
    return;
  }

  let queue = prepareImageQueues(manifest, manualConnects, people, disconnectedPairs);

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
    junkPairs,
    facesOutputDir,
    sourceDir,
    detailsDir,
    facesManifest,
    manualConnects,
  );

  logger.info(`✅ Found ${people.length} unique people.`);

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
        }
      }
    }
  }
  await saveFacesManifest(dataDir, facesManifest);

  await savePeopleManifest(dataDir, { people });
}

(async () => {
  // const startTime = performance.now();
  try {
    await main();
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }
})();

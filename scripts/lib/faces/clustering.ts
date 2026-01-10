import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import path from "node:path";
import type { Person } from "../../../src/lib/types/manifest";
import { createLogger } from "$scripts/core/cli-logger";
import { ensureDir } from "$scripts/image/utils";
import { safeUnlink, writeFile } from "$scripts/utils/runtime";

const logger = createLogger("clustering-utils");

export function euclideanDistance(desc1: number[], desc2: number[]): number {
  return faceapi.euclideanDistance(desc1, desc2);
}

/**
 * Calculate the arithmetic mean centroid from multiple descriptors.
 * Used when creating a new cluster from raw face descriptors.
 */
export function calculateCentroid(descriptors: number[][]): number[] {
  if (descriptors.length === 0) return [];
  if (descriptors.length === 1) return [...descriptors[0]];

  const dimensions = descriptors[0].length;
  const centroid = new Array(dimensions).fill(0);

  for (const descriptor of descriptors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += descriptor[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= descriptors.length;
  }

  return centroid;
}

/**
 * Incrementally update a centroid with a new descriptor.
 * Uses running average formula: new = (old * n + new) / (n + 1)
 */
export function updateCentroid(
  currentCentroid: number[],
  currentCount: number,
  newDescriptor: number[],
): number[] {
  if (currentCentroid.length === 0) return [...newDescriptor];

  const updatedCentroid = new Array(currentCentroid.length);
  for (let i = 0; i < currentCentroid.length; i++) {
    updatedCentroid[i] =
      (currentCentroid[i] * currentCount + newDescriptor[i]) / (currentCount + 1);
  }
  return updatedCentroid;
}

/**
 * Merge multiple clusters into a single cluster with weighted centroid.
 * Each cluster's centroid is weighted by its faceCount.
 */
export function mergeClusters(clusters: Array<{ centroid: number[]; faceCount: number }>): {
  centroid: number[];
  faceCount: number;
} {
  if (clusters.length === 0) {
    return { centroid: [], faceCount: 0 };
  }

  if (clusters.length === 1) {
    return { centroid: [...clusters[0].centroid], faceCount: clusters[0].faceCount };
  }

  const totalFaceCount = clusters.reduce(function (sum, cluster) {
    return sum + cluster.faceCount;
  }, 0);

  if (totalFaceCount === 0) {
    return { centroid: [], faceCount: 0 };
  }

  const dimensions = clusters[0].centroid.length;
  const mergedCentroid = new Array(dimensions).fill(0);

  for (const cluster of clusters) {
    const weight = cluster.faceCount / totalFaceCount;
    for (let i = 0; i < dimensions; i++) {
      mergedCentroid[i] += cluster.centroid[i] * weight;
    }
  }

  return { centroid: mergedCentroid, faceCount: totalFaceCount };
}

export function calculatePersonDistance(
  descriptor: number[],
  person: Person,
  targetYear?: number,
): number {
  if (person.clusters && person.clusters.length > 0) {
    let minDistance = 100.0;
    for (const cluster of person.clusters) {
      if (cluster.centroid && cluster.centroid.length > 0) {
        let d = euclideanDistance(descriptor, cluster.centroid);

        // Temporal Penalty: If years differ, add small penalty to distance.
        // This helps disambiguate people who look similar but are from different eras,
        // while still allowing matches if the visual similarity is strong.
        // Penalty: 0.02 per year difference, max capped at 0.08 (approx 16% of default threshold).
        if (targetYear && cluster.year && targetYear !== cluster.year) {
          const yearDiff = Math.abs(targetYear - cluster.year);
          d += Math.min(0.08, yearDiff * 0.02);
        }

        // Category Stickiness:
        // If the person is explicitly marked as a statue or painting, we give it a small "bonus" (reduce distance).
        // This makes these entities "sticky" or "magnetic", helping to capture ambiguous faces that might otherwise
        // drift to human clusters, preventing false positives in human groups.
        if (person.category === "statue" || person.category === "painting") {
          d -= 0.05; // 10% of default threshold (0.5)
        }

        if (d < minDistance) minDistance = d;
      }
    }
    return minDistance;
  }

  // Fallback for legacy data (should be migrated by now but safe to keep)
  if (person.faceDescriptor && person.faceDescriptor.length > 0) {
    let d = euclideanDistance(descriptor, person.faceDescriptor);

    // Category Stickiness (applied to legacy as well for consistency)
    if (person.category === "statue" || person.category === "painting") {
      d -= 0.05;
    }
    return d;
  }

  return 1.0;
}

export function isConstrainedPair(
  constraints: Set<string>,
  imageId: string,
  personId: string,
): boolean {
  return constraints.has(`${imageId}:${personId}`);
}

interface DistanceCandidate {
  person: Person;
  distance: number;
}

function isWithinThreshold(threshold: number) {
  return function candidateIsWithinThreshold(candidate: DistanceCandidate): boolean {
    return candidate.distance < threshold;
  };
}

function compareByDistance(a: DistanceCandidate, b: DistanceCandidate): number {
  return a.distance - b.distance;
}

function isNotConstrained(constraints: Set<string>, imageId: string) {
  return function candidateIsNotConstrained(candidate: DistanceCandidate): boolean {
    return !isConstrainedPair(constraints, imageId, candidate.person.id);
  };
}

export function findBestMatch(
  descriptor: number[],
  people: Person[],
  constraints: Set<string>,
  imageId: string,
  threshold: number,
  targetYear?: number,
): Person | null {
  function mapPersonToCandidate(person: Person): DistanceCandidate {
    return {
      person,
      distance: calculatePersonDistance(descriptor, person, targetYear),
    };
  }

  const bestCandidate = people
    .map(mapPersonToCandidate)
    .filter(isWithinThreshold(threshold))
    .sort(compareByDistance)
    .filter(isNotConstrained(constraints, imageId))[0];

  return bestCandidate?.person ?? null;
}

export async function saveFaceCrop(
  img: canvas.Image,
  box: { x: number; y: number; width: number; height: number },
  personId: string,
  imageId: string,
  facesOutputDir: string,
): Promise<Buffer> {
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
  await writeFile(cropPath, buffer);

  return buffer;
}

export async function deleteOldFaceCrops(
  imageId: string,
  oldPersonIds: string[],
  facesOutputDir: string,
  log: typeof logger = logger,
): Promise<void> {
  for (const personId of oldPersonIds) {
    const cropPath = path.join(facesOutputDir, personId, `${imageId}.jpg`);
    try {
      await safeUnlink(cropPath);
    } catch (e: unknown) {
      // safeUnlink already handles ENOENT, so any error here is unexpected.
      log.warn({ err: e, cropPath }, "Failed to delete old crop");
    }
  }
}

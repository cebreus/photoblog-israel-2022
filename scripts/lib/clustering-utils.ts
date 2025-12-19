import fsp from "node:fs/promises";
import path from "node:path";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node.js";
import * as canvas from "canvas";
import type { Person } from "../../src/lib/types/manifest";
import { ensureDir } from "./image-utils";
import { hasValidFaceDescriptor } from "./people-utils";

export function euclideanDistance(desc1: number[], desc2: number[]): number {
  return faceapi.euclideanDistance(desc1, desc2);
}

export function calculatePersonDistance(descriptor: number[], person: Person): number {
  if (!hasValidFaceDescriptor(person)) {
    return 1.0;
  }
  return euclideanDistance(descriptor, person.faceDescriptor);
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

function isNotIgnored(candidate: DistanceCandidate): boolean {
  return !candidate.person.ignored;
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
): Person | null {
  function mapPersonToCandidate(person: Person): DistanceCandidate {
    return {
      person,
      distance: calculatePersonDistance(descriptor, person),
    };
  }

  const bestCandidate = people
    .map(mapPersonToCandidate)
    .filter(isWithinThreshold(threshold))
    .sort(compareByDistance)
    .filter(isNotIgnored)
    .filter(isNotConstrained(constraints, imageId))[0];

  return bestCandidate?.person ?? null;
}

export async function saveFaceCrop(
  img: any, // Canvas.Image / HTMLImageElement
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
  await fsp.writeFile(cropPath, buffer);

  return buffer;
}

export async function deleteOldFaceCrops(
  imageId: string,
  oldPersonIds: string[],
  facesOutputDir: string,
): Promise<void> {
  for (const personId of oldPersonIds) {
    const cropPath = path.join(facesOutputDir, personId, `${imageId}.jpg`);
    try {
      await fsp.unlink(cropPath);
      // console.log(`  Deleted old crop: ${personId}/${imageId}.jpg`);
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        console.warn(`  Failed to delete old crop ${cropPath}: ${e.message}`);
      }
    }
  }
}

/**
 * @fileoverview Image utility functions: quality, aspect ratio, and file helpers.
 *
 * @description
 * Contains small helpers for image metadata, quality buckets, alt text, and safe file ops.
 */
import {
  isHeicPath,
  mkdir,
  readFileBuffer,
  safeUnlink,
  validatePathInsideRoot,
} from "$scripts/utils/runtime";
import { run } from "$scripts/utils/shell";
import crypto from "node:crypto";
import os from "node:os"; // Bun's native os module
import path from "node:path"; // Bun's native path module
import type { AspectRatio, QualityBucket } from "../../../src/lib/types/manifest";

const SAFE_INPUT_ROOT = process.cwd();

const EXCELLENT_AESTHETIC_THRESHOLD = 65;
const EXCELLENT_SHARPNESS_THRESHOLD = 80;
const POOR_AESTHETIC_THRESHOLD = 45;
const POOR_SHARPNESS_THRESHOLD = 40;

export function getQualityBucket(aestheticScore: number, sharpness: number): QualityBucket {
  if (
    aestheticScore >= EXCELLENT_AESTHETIC_THRESHOLD &&
    sharpness >= EXCELLENT_SHARPNESS_THRESHOLD
  ) {
    return "excellent";
  }

  if (aestheticScore < POOR_AESTHETIC_THRESHOLD || sharpness < POOR_SHARPNESS_THRESHOLD) {
    return "poor";
  }

  return "good";
}

export function normalizeSharpness(rawSharpness: number): number {
  if (rawSharpness <= 0) return 0;
  const normalized = Math.round(rawSharpness * 0.03);
  return Math.min(100, normalized);
}

type LandscapeRatio = `landscape-${number}-${number}`;
type PortraitRatio = `portrait-${number}-${number}`;

function formatLandscapeRatio(width: number, height: number): LandscapeRatio {
  return `landscape-${width}-${height}`;
}

function formatPortraitRatio(width: number, height: number): PortraitRatio {
  return `portrait-${width}-${height}`;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function getAspectRatioName(width?: number, height?: number): AspectRatio | undefined {
  if (!width || !height) return undefined;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "square";
  if (ratio > 2.2) return "panorama";
  if (Math.abs(ratio - 16 / 9) < 0.05) return "landscape-16-9";
  if (Math.abs(ratio - 3 / 2) < 0.05) return "landscape-3-2";
  if (Math.abs(ratio - 4 / 3) < 0.05) return "landscape-4-3";
  if (Math.abs(ratio - 9 / 16) < 0.05) return "portrait-9-16";
  if (Math.abs(ratio - 2 / 3) < 0.05) return "portrait-2-3";
  if (Math.abs(ratio - 3 / 4) < 0.05) return "portrait-3-4";

  const normalizedWidth = Math.max(1, Math.round(width));
  const normalizedHeight = Math.max(1, Math.round(height));
  const divisor = gcd(normalizedWidth, normalizedHeight);
  const reducedWidth = normalizedWidth / divisor;
  const reducedHeight = normalizedHeight / divisor;

  if (reducedWidth >= reducedHeight) {
    return formatLandscapeRatio(reducedWidth, reducedHeight);
  }
  return formatPortraitRatio(reducedWidth, reducedHeight);
}

export function normalizeText(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return normalizeText(value[0]);
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function getAltText(
  exif: Record<string, unknown>,
  captionNorm?: string,
  titleNorm?: string,
): string {
  const parts: string[] = [];
  if (captionNorm) parts.push(captionNorm);
  else if (titleNorm) parts.push(titleNorm);
  if (exif.Location) parts.push(String(exif.Location).trim());
  if (exif.City) parts.push(String(exif.City).trim());
  if (parts.length > 0) return parts.join(", ");
  const fallback = exif.ImageDescription || exif.ObjectName || "Photoblog image";
  return String(fallback);
}

export function getKeywords(exif: Record<string, unknown>): string[] | undefined {
  const k = exif.Keywords || exif.Subject || exif["dc:subject"];
  if (!k) return undefined;
  if (Array.isArray(k)) return k.map(String);
  if (typeof k === "string") return k.split(/\s*,\s*/).filter(Boolean);
  return undefined;
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function sha1(buf: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

type SharpType = typeof import("sharp");

export async function calculateSharpness(
  sharpModule: SharpType,
  imagePath: string,
): Promise<number> {
  const LaplacianKernel = {
    width: 3,
    height: 3,
    kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0],
  };

  try {
    const stats = await sharpModule(imagePath)
      .resize({ width: 500, withoutEnlargement: true })
      .grayscale()
      .convolve(LaplacianKernel)
      .stats();

    const stdev = stats.channels[0].stdev;

    return stdev * stdev;
  } catch (e) {
    throw new Error(
      `Failed to calculate sharpness for ${imagePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export async function calculatePhash(sharpModule: SharpType, imagePath: string): Promise<string> {
  try {
    const buffer = await sharpModule(imagePath)
      .resize(9, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();

    let hash = 0n;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = buffer[y * 9 + x];
        const right = buffer[y * 9 + x + 1];
        if (left > right) {
          hash |= 1n << BigInt(y * 8 + x);
        }
      }
    }

    return hash.toString(16).padStart(16, "0");
  } catch (e) {
    throw new Error(
      `Failed to calculate pHash for ${imagePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export async function prepareImageProcessingPath(
  inputPath: string,
): Promise<{ processingPath: string; tempFile: string | null }> {
  if (isHeicPath(inputPath)) {
    const validatedInputPath = validatePathInsideRoot(inputPath, SAFE_INPUT_ROOT);
    const tempFile = path.join(os.tmpdir(), `heic-proc-${crypto.randomUUID()}.png`);

    try {
      try {
        // Prefer vips as it is faster on this system
        await run("vips", ["copy", validatedInputPath, tempFile], { stdio: "ignore" });
      } catch {
        // Fallback to sips if vips fails
        await run("sips", ["-s", "format", "png", validatedInputPath, "--out", tempFile], {
          stdio: "ignore",
        });
      }
      return { processingPath: tempFile, tempFile };
    } catch (e) {
      throw new Error(`Failed to convert HEIC to intermediate PNG for ${inputPath}: ${e}`);
    }
  }
  return { processingPath: inputPath, tempFile: null };
}

/**
 * Converts HEIC to PNG Buffer using the shared processing logic.
 */
export async function convertHeicToPng(inputPath: string): Promise<Buffer> {
  const { processingPath, tempFile } = await prepareImageProcessingPath(inputPath);
  try {
    return await readFileBuffer(processingPath);
  } finally {
    if (tempFile) {
      await safeUnlink(tempFile);
    }
  }
}

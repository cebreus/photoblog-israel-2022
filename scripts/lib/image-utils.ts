import crypto from "node:crypto";
import fsp from "node:fs/promises";
import type { AspectRatio, QualityBucket } from "../../src/lib/types/manifest";

type LandscapeRatio = `landscape-${number}-${number}`;
type PortraitRatio = `portrait-${number}-${number}`;

/**
 * Formats a landscape aspect ratio string.
 */
function formatLandscapeRatio(width: number, height: number): LandscapeRatio {
  return `landscape-${width}-${height}`;
}

/**
 * Formats a portrait aspect ratio string.
 */
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

/**
 * Return a human-friendly aspect ratio name for given dimensions.
 */
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

/**
 * Normalize various input types to a trimmed string or undefined.
 */
export function normalizeText(value: any): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return normalizeText(value[0]);
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

/**
 * Compose an alt text string from EXIF, caption or title data.
 */
export function getAltText(exif: any, captionNorm?: string, titleNorm?: string) {
  const parts: string[] = [];
  if (captionNorm) parts.push(captionNorm);
  else if (titleNorm) parts.push(titleNorm);
  if (exif.Location) parts.push(String(exif.Location).trim());
  if (exif.City) parts.push(String(exif.City).trim());
  return parts.length
    ? parts.join(", ")
    : exif.ImageDescription || exif.ObjectName || "Photoblog image";
}

/**
 * Extract keywords from EXIF tag values.
 */
export function getKeywords(exif: any): string[] | undefined {
  const k = exif.Keywords || exif.Subject || exif["dc:subject"];
  if (!k) return undefined;
  if (Array.isArray(k)) return k.map(String);
  if (typeof k === "string") return k.split(/\s*,\s*/).filter(Boolean);
  return undefined;
}

/**
 * Create a directory and its parents if they do not exist.
 */
export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Calculate the SHA-1 hex digest of a buffer or string.
 */
export function sha1(buf: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

type SharpType = typeof import("sharp");

/**
 * Estimate image sharpness by applying a Laplacian filter and returning variance.
 */
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

    // Sharp stats() on a grayscale image typically returns a 'channels' array
    // We want the standard deviation of the first channel (brightness/luminance)
    const stdev = stats.channels[0].stdev;

    return stdev * stdev;
  } catch (e) {
    console.warn(`Failed to calculate sharpness for ${imagePath}:`, e);
    return 0;
  }
}

/**
 * Normalizes a raw sharpness score (Laplacian variance) to 0-100 range.
 */
export function normalizeSharpness(variance: number): number {
  if (variance <= 0) return 0;
  // variance typically goes from 0 to 10000+.
  // Sharp images are usually > 2000.
  // We use sqrt to compress the high end.
  const root = Math.sqrt(variance);
  // root of 10000 is 100. root of 2500 is 50. root of 100 is 10.
  // We want 2500 to be around 70-80.
  const scaled = root * 1.5;
  return Math.max(0, Math.min(100, scaled));
}

/**
 * Determines the quality bucket based on normalized aesthetic and sharpness scores.
 */
export function getQualityBucket(aesthetic: number, sharpness: number): QualityBucket {
  // Excellent: beautiful AND sharp enough
  if (aesthetic >= 65 && sharpness >= 40) return "excellent";

  // Good:
  // 1. Decent aesthetic AND minimum sharpness
  if (aesthetic >= 50 && sharpness >= 30) return "good";
  // 2. Exceptionally sharp AND enough aesthetic (documentary/detail focus)
  if (aesthetic >= 40 && sharpness >= 70) return "good";

  // Poor: default
  return "poor";
}

/**
 * Compute a perceptual hash (dHash) for an image and return it as hexadecimal.
 */
export async function calculatePhash(sharpModule: SharpType, imagePath: string): Promise<string> {
  try {
    // dHash algorithm:
    // 1. Resize to 9x8 (72 pixels)
    // 2. Grayscale
    // 3. To buffer
    // 4. Compare pixel[i] with pixel[i+1]
    const buffer = await sharpModule(imagePath)
      .resize(9, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();

    let hash = 0n;

    // Iterate over rows
    for (let y = 0; y < 8; y++) {
      // Iterate over cols up to width-1
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
    console.warn(`Failed to calculate pHash for ${imagePath}:`, e);
    return "0000000000000000";
  }
}

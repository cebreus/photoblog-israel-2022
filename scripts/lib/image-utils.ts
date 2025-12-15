import fsp from "node:fs/promises";
import crypto from "node:crypto";
import type { AspectRatio } from "../../src/lib/types/manifest";

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

/**
 * Compute a human-friendly aspect ratio name (canonical or reduced numeric) for width/height.
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

export function normalizeText(value: any): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return normalizeText(value[0]);
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

/**
 * Build an accessible alt string for an image using caption/title and location data.
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

export function getKeywords(exif: any): string[] | undefined {
  const k = exif.Keywords || exif.Subject || exif["dc:subject"];
  if (!k) return undefined;
  if (Array.isArray(k)) return k.map(String);
  if (typeof k === "string") return k.split(/\s*,\s*/).filter(Boolean);
  return undefined;
}

/**
 * Ensure the directory exists, creating it recursively when necessary.
 */

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

export function sha1(buf: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

type SharpType = typeof import("sharp");

/**
 * Calculates a sharpness score using Laplacian Variance.
 * Higher score = sharper image.
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
 * Calculates a perceptual difference hash (dHash).
 * Returns a 64-bit hex string.
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

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

export function getAspectRatioName(
  width?: number,
  height?: number,
): AspectRatio | undefined {
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

export function getAltText(
  exif: any,
  captionNorm?: string,
  titleNorm?: string,
) {
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

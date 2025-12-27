import { log } from "$lib/logger";
import type { CollageTemplateId } from "$lib/types/collage";
import type { ImageEntry } from "$lib/types/manifest";
import { calculateLayout } from "./collage-layout-engine";
import { COLLAGE_MESSAGES } from "./messages";

/**
 * Normalize the user-entered border width so it scales with source image dimensions.
 */
export function calculateNormalizedBorderWidth(setting: number, images: ImageEntry[]): number {
  if (!setting || images.length === 0) return Math.max(Math.round(setting), 0);
  let total = 0;
  for (const img of images) {
    total += (img.width ?? 1000) + (img.height ?? 1000);
  }
  const avgDimension = total / (images.length * 2);
  const scale = avgDimension / 1000;
  log.info(
    `[CollageUtil] Normalizing border: setting=${setting}, avgDim=${avgDimension.toFixed(0)}, scale=${scale.toFixed(2)}, res=${Math.max(1, Math.round(setting * scale))}`,
  );
  return Math.max(1, Math.round(Math.max(setting, 0) * Math.max(scale, 0.1)));
}

/**
 * Denormalize border width - reverse the calculation to guess original setting from pixel value.
 */
export function calculateDenormalizedBorderWidth(pixelWidth: number, images: ImageEntry[]): number {
  if (!pixelWidth || images.length === 0) return Math.max(Math.round(pixelWidth), 0);
  let total = 0;
  for (const img of images) {
    total += (img.width ?? 1000) + (img.height ?? 1000);
  }
  const avgDimension = total / (images.length * 2);
  const scale = avgDimension / 1000;
  return Math.round(pixelWidth / Math.max(scale, 0.1));
}

function validateImageDimensions(img: ImageEntry) {
  return {
    ...img,
    width: img.width && img.width > 0 ? img.width : 1000,
    height: img.height && img.height > 0 ? img.height : 1000,
  };
}

function _formatImageDimensions(img: { width: number; height: number }): string {
  return `${img.width}x${img.height}`;
}

function convertToPercentagePlacement(
  p: {
    x: number;
    y: number;
    width: number;
    height: number;
    img: ImageEntry;
  },
  safeW: number,
  safeH: number,
) {
  return {
    img: p.img,
    left: (p.x / safeW) * 100,
    top: (p.y / safeH) * 100,
    width: (p.width / safeW) * 100,
    height: (p.height / safeH) * 100,
  };
}

/**
 * Calculate refined collage layout with optical margin weighting (Gallery Style).
 * - Inner Gutter (Mezera): u = borderW
 * - Outer Margin (Okraj): 2u
 * - Bottom Margin (Podstava): 3u
 */
export function calculateCollageLayout(
  imgs: ImageEntry[],
  template: CollageTemplateId,
  borderW: number,
) {
  if (imgs.length === 0) return { width: 100, height: 100, placements: [] };

  log.info(
    `[CollageUtil] Calculating preview layout: template=${template}, borderW=${borderW}, imgs=${imgs.length}`,
  );
  const validImages = imgs.map(validateImageDimensions);

  // Use shared layout engine
  const layout = calculateLayout(validImages, template, {
    border: { width: borderW },
    cropStrategy: "simple",
  });

  const safeW = layout.width || 1000;
  const safeH = layout.height || 1000;
  log.info(
    `[CollageUtil] Layout calculated: ${safeW}x${safeH}, placements=${layout.placements.length}`,
  );

  function toPercentage(p: {
    x: number;
    y: number;
    width: number;
    height: number;
    item: ImageEntry;
  }) {
    return convertToPercentagePlacement({ ...p, img: p.item }, safeW, safeH);
  }

  return {
    width: safeW,
    height: safeH,
    placements: layout.placements.map(toPercentage),
  };
}

export function getImageAspectRatio(img: ImageEntry): string {
  const width = img.width && img.width > 0 ? img.width : 1;
  const height = img.height && img.height > 0 ? img.height : 1;
  return `${width}/${height}`;
}

export function parsePresetRatio(presetId: string) {
  function toNumber(str: string): number {
    return Number(str);
  }
  const [w, h] = presetId.split(":").map(toNumber);
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

function isMatchingVariant(source: { variant: string }, targetVariant: string): boolean {
  return source.variant === targetVariant;
}

export function findSourceByVariant(image: ImageEntry, variant: string) {
  function matchesVariant(source: { variant: string }): boolean {
    return isMatchingVariant(source, variant);
  }
  return image.sources?.find(matchesVariant);
}

export function getDetailSource(image: ImageEntry) {
  return findSourceByVariant(image, "detail") ?? image.sources?.[0];
}

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function formatDimensionLabel(width?: number, height?: number): string {
  if (!width || !height) return COLLAGE_MESSAGES.NOT_AVAILABLE;
  return `${Math.round(width)} × ${Math.round(height)}`;
}

export function formatRatioLabel(width?: number, height?: number): string {
  if (!width || !height) return COLLAGE_MESSAGES.NOT_AVAILABLE;
  const w = Math.round(width);
  const h = Math.round(height);
  const divisor = Math.max(gcd(w, h), 1);
  return `${Math.round(w / divisor)}:${Math.round(h / divisor)}`;
}

export function determineOrientation(images: ImageEntry[]): "portrait" | "landscape" {
  let landscape = 0;
  let portrait = 0;
  for (const img of images) {
    if (!img.width || !img.height) continue;
    if (img.height > img.width) portrait++;
    else if (img.width > img.height) landscape++;
  }
  const result = portrait > landscape ? "portrait" : "landscape";
  log.info(`[CollageUtil] Determined orientation: ${result} (P:${portrait}, L:${landscape})`);
  return result;
}

export function determineAutoTemplate(images: ImageEntry[]): CollageTemplateId {
  const orientation = determineOrientation(images);
  const result = orientation === "portrait" ? "column" : "row";
  log.info(`[CollageUtil] Auto-template for ${images.length} images: ${result}`);
  return result;
}

export function calculateAmbientCanvasSize(
  layoutWidth: number,
  layoutHeight: number,
  sampleScale: number,
) {
  return {
    width: Math.max(1, Math.round(layoutWidth * sampleScale)),
    height: Math.max(1, Math.round(layoutHeight * sampleScale)),
  };
}

export function getAmbientPlacementRect(
  placement: { left: number; top: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  sampleScale: number,
  bleedScale: number,
) {
  const baseLeft = Math.round(placement.left * sampleScale);
  const baseTop = Math.round(placement.top * sampleScale);
  const baseWidth = Math.max(1, Math.round(placement.width * sampleScale));
  const baseHeight = Math.max(1, Math.round(placement.height * sampleScale));

  const bleedWidth = Math.max(1, Math.round(baseWidth * bleedScale));
  const bleedHeight = Math.max(1, Math.round(baseHeight * bleedScale));

  const boundedWidth = Math.min(bleedWidth, canvasWidth);
  const boundedHeight = Math.min(bleedHeight, canvasHeight);

  const offsetX = Math.round((boundedWidth - baseWidth) / 2);
  const offsetY = Math.round((boundedHeight - baseHeight) / 2);

  const maxLeft = Math.max(canvasWidth - boundedWidth, 0);
  const maxTop = Math.max(canvasHeight - boundedHeight, 0);

  return {
    left: clamp(baseLeft - offsetX, 0, maxLeft),
    top: clamp(baseTop - offsetY, 0, maxTop),
    width: boundedWidth,
    height: boundedHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

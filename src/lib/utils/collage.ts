import { log } from "$lib/logger";
import type { CollageCrop, CollageTemplateId } from "$lib/types/collage";
import type { ImageEntry } from "$lib/types/manifest";
import { calculateLayout } from "./collage-layout-engine";

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
    { setting, avgDimension, scale, result: Math.max(1, Math.round(setting * scale)) },
    "[CollageUtil] Normalizing border",
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
 * Calculate refined collage layout with uniform margins and 2/3 width inner gutters.
 */
export function calculateCollageLayout(
  imgs: ImageEntry[],
  template: CollageTemplateId,
  borderW: number,
  options: {
    aspectRatio?: string;
    imageConfigs?: Record<string, CollageCrop>;
    maxDimension?: number;
  } = {},
) {
  if (imgs.length === 0) return { width: 100, height: 100, placements: [] };

  log.info(
    { template, borderW, aspectRatio: options.aspectRatio, imagesCount: imgs.length },
    "[CollageUtil] Calculating preview layout",
  );
  const validImages = imgs.map(validateImageDimensions).map((img) => ({
    ...img,
    crop: options.imageConfigs?.[img.id],
  }));

  // Use shared layout engine
  const layout = calculateLayout(validImages, template, {
    border: { width: borderW },
    cropStrategy: "simple",
    aspectRatio: options.aspectRatio,
    maxDimension: options.maxDimension,
  });

  const safeW = layout.width || 1000;
  const safeH = layout.height || 1000;
  log.info(
    { width: safeW, height: safeH, placementsCount: layout.placements.length },
    "[CollageUtil] Layout calculated",
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

import * as m from "$lib/paraglide/messages";

export function formatDimensionLabel(width?: number, height?: number): string {
  if (!width || !height) return m.collage_not_available();
  return `${Math.round(width)} × ${Math.round(height)}`;
}

export function formatRatioLabel(width?: number, height?: number): string {
  if (!width || !height) return m.collage_not_available();
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
  log.info({ result, portrait, landscape }, "[CollageUtil] Determined orientation");
  return result;
}

export function determineAutoTemplate(images: ImageEntry[]): CollageTemplateId {
  const orientation = determineOrientation(images);
  const result = orientation === "portrait" ? "column" : "row";
  log.info({ imagesCount: images.length, result }, "[CollageUtil] Auto-template determined");
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

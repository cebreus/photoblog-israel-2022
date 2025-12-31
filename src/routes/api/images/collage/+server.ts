import fs from "node:fs/promises";
import path from "node:path";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import sharp from "sharp";
import { getContentDir } from "$lib/config";
import { log } from "$lib/logger";
import type { CollageItemConfig, CollageRequest, CollageResponse } from "$lib/types/collage";
import {
  calculateLayout,
  type LayoutItem,
  type SharedLayout,
} from "$lib/utils/collage-layout-engine";
import { renderCollage } from "$lib/utils/collage-renderer";
import { reloadManifests } from "$lib/utils/images";
import { COLLAGE_MESSAGES } from "$lib/utils/messages";

import { config as buildConfig } from "$scripts/build.config";
import { loadSharpOrExplain, processImage } from "$scripts/lib/image/processor";
import { generateMenuManifest, updateManifest } from "$scripts/lib/manifests/builder";
import { loadStoryData } from "$scripts/lib/manifests/incremental";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadAnalysisManifest,
  loadFacesManifest,
  loadImagesManifest,
  saveAnalysisManifest,
  saveFacesManifest,
  saveImagesManifest,
  saveMenuManifest,
} from "$scripts/lib/manifests/repository";

// DEV-only guard (reject in production)
const IS_DEV = import.meta.env.DEV;

/**
 * Return the provided item's imageId.
 */
function mapImageId(item: CollageItemConfig): string {
  return item.imageId;
}

/**
 * Augment item config with source/moved paths used for sidecar persistence.
 */
function mapConfigItem(item: CollageItemConfig, idx: number, imageIds: string[]) {
  return {
    ...item,
    originalPath: imageIds[idx],
    movedPath: path.join("collage-sources", imageIds[idx]),
  };
}

/**
 * Main POST handler for creating a collage.
 * Validates request, resolves source files, computes layout, renders collage,
 * copies EXIF, moves sources and updates manifests.
 */
export async function POST({ request }: RequestEvent): Promise<Response> {
  if (!IS_DEV) {
    return json({ success: false, error: COLLAGE_MESSAGES.DEV_ONLY }, { status: 403 });
  }

  try {
    const startTotal = Date.now();

    const body = (await request.json()) as CollageRequest;
    log.info(`[Collage API] Received request:`, JSON.parse(JSON.stringify(body)));
    validateCollageRequest(body);

    const contentDirName = getContentDir();
    const contentDirRoot = path.join(process.cwd(), "content", contentDirName);

    // Resolve source paths for requested image IDs.
    const imageIds = body.items.map(mapImageId);
    log.info(`[Collage API] Resolving paths for IDs:`, imageIds);
    const sourcePaths = await resolveSourcePaths(imageIds, contentDirRoot);
    log.info(`[Collage API] Resolved source paths:`, sourcePaths);

    // Choose metadata source by EXIF date (oldest).
    const startSort = Date.now();
    const sortedByTime = await sortByDateTimeOriginal(sourcePaths);
    log.debug(`[Collage] Seřazení podle EXIF: ${Date.now() - startSort}ms`);
    const metadataSourcePath = sortedByTime[0];

    // Gather image dimensions and bind config for layout calculation.
    const startMeta = Date.now();
    async function resolveMetadata(p: string, idx: number) {
      const m = await sharp(p).metadata();
      return {
        path: p,
        id: imageIds[idx],
        width: m.width ?? 0,
        height: m.height ?? 0,
        config: body.items[idx],
        crop: body.items[idx].crop, // Map crop to root for engine
      };
    }
    const imageMetas = await Promise.all(sourcePaths.map(resolveMetadata));
    log.debug(`[Collage] Načtení metadat: ${Date.now() - startMeta}ms`);

    // Layout calculation (border width only, background handled separately).
    const layout = calculateLayout(imageMetas, body.template, {
      border: body.border ?? { width: 0 },
      cropStrategy: "simple",
    });

    // Prevent upscaling by reducing overall layout scale if necessary.
    let finalLayout = applyQualityScale(layout);

    // Enforce Aspect Ratio if specified (e.g., "1:1")
    if (body.aspectRatio && body.aspectRatio !== "auto") {
      finalLayout = applyAspectRatio(finalLayout, body.aspectRatio);
    }

    // Enforce an upper bound for resulting canvas (8K).
    finalLayout = applyMaxDimensionLimit(finalLayout);

    // Render collage to a JPEG buffer.
    const startRender = Date.now();
    const buffer = await renderCollage(
      finalLayout,
      body.border ?? { width: 0 },
      body.background ?? { style: "color", color: "#ffffff" },
    );
    log.info(`[Collage] Renderování dokončeno: ${Date.now() - startRender}ms`);

    // Persist collage image and sidecar.
    const ext = path.extname(metadataSourcePath);
    const basename = path.basename(metadataSourcePath, ext);
    const outputFilename = `pics/${basename}--collage.jpg`;
    const outputPath = path.join(contentDirRoot, outputFilename);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await saveCollageImage(buffer, outputPath);

    const configPath = path.join(contentDirRoot, `pics/${basename}--collage.json`);
    function mapItemsForConfig(item: CollageItemConfig, idx: number) {
      return mapConfigItem(item, idx, imageIds);
    }
    const configWithPaths = {
      ...body,
      metadata: {
        name: `${basename}--collage.jpg`,
        created: new Date().toISOString(),
        canvasWidth: finalLayout.width,
        canvasHeight: finalLayout.height,
      },
      items: body.items.map(mapItemsForConfig),
    };
    log.info(
      `[Collage API] Saving configuration to ${configPath}:`,
      JSON.parse(JSON.stringify(configWithPaths)),
    );
    await fs.writeFile(configPath, JSON.stringify(configWithPaths, null, 2));

    // Copy EXIF metadata from chosen source image into the collage.
    const startExif = Date.now();
    function getBasename(p: string) {
      return path.basename(p);
    }
    const sourceNames = sourcePaths.map(getBasename).join(", ");
    await copyMetadataFromSource(metadataSourcePath, outputPath, sourceNames);
    log.debug(`[Collage] Kopírování EXIF: ${Date.now() - startExif}ms`);

    // Move original source files into content/<gallery>/collage-sources preserving structure.
    await moveSourceImages(sourcePaths, contentDirRoot, imageIds);

    // Post-processing: generate variants and update manifests under lock.
    const startPost = Date.now();
    const dataPath = path.join(process.cwd(), "src/data", contentDirName);
    const staticRoot = path.join(process.cwd(), "static", contentDirName, "images");

    await loadSharpOrExplain();

    await withManifestLock(dataPath, async () => {
      // A. Process the new collage image (generate variants, blurs, etc.)
      const processResult = await processImage(outputPath, {
        manifestOnly: false,
        curation: false,
        srcRoot: contentDirRoot,
        outRoot: staticRoot,
        allowUpscale: false,
        formats: [...buildConfig.encoding.formats],
        qualityOverrides: {},
        skipFaces: true,
        skipEmbeddings: true,
      });

      if (!processResult) {
        throw new Error("Failed to process collage image variants");
      }

      // ReleaseDate Inheritance:
      // The collage automatically inherits ReleaseDate from the metadata source
      // (earliest source image by EXIF date) via copyMetadataFromSource() below.
      // This ensures the collage appears at the correct chronological position.

      // B. Update manifests (hide originals, add collage).
      const existingManifest = (await loadImagesManifest(dataPath)) || { photoDays: [] };

      // INHERIT PEOPLE: Collect people from source images before they are hidden
      const sourceBasenames = imageIds.map((id) => path.basename(id, path.extname(id)));
      const inheritedPeople = new Set<string>();

      for (const day of existingManifest.photoDays) {
        for (const item of day.items) {
          if (item.type === "image" && sourceBasenames.includes(item.id) && item.people) {
            for (const p of item.people) {
              inheritedPeople.add(p);
            }
          }
        }
      }

      // Assign inherited people to the new collage image
      processResult.image.people = Array.from(inheritedPeople);
      log.info(`[Collage] Inherited people: ${processResult.image.people.join(", ")}`);

      const storyData = await loadStoryData(contentDirRoot);
      const deletedBasenames = sourceBasenames;
      const updatedManifest = updateManifest(
        [processResult],
        deletedBasenames,
        storyData,
        existingManifest,
      );

      // C. Save manifests
      await saveImagesManifest(dataPath, updatedManifest);
      const menuManifest = generateMenuManifest(updatedManifest);
      await saveMenuManifest(dataPath, menuManifest);

      // D. Update auxiliary manifests for the new collage
      const collageId = processResult.image.id;

      if (processResult.image.analysis) {
        const analysisManifest = (await loadAnalysisManifest(dataPath)) || {};
        analysisManifest[collageId] = {
          sharpness: processResult.image.analysis.sharpness,
          phash: processResult.image.analysis.phash,
          aestheticScore: processResult.image.analysis.aestheticScore,
          qualityBucket: processResult.image.analysis.qualityBucket,
        };
        await saveAnalysisManifest(dataPath, analysisManifest);
      }

      const facesManifest = (await loadFacesManifest(dataPath)) || {};
      facesManifest[collageId] = {
        facesDetected: processResult.image.analysis?.facesDetected ?? false,
        faces: processResult.image.analysis?.faces ?? [],
        peopleIds: processResult.image.people ?? [],
      };
      await saveFacesManifest(dataPath, facesManifest);
    });

    // Force reload of in-memory manifest cache
    await reloadManifests();

    log.info(`[Collage] Post-processing dokončeno: ${Date.now() - startPost}ms`);

    const response: CollageResponse = {
      success: true,
      outputPath: outputFilename,
    };

    log.info(`[Collage] Úspěch: ${outputFilename} (Celkem: ${Date.now() - startTotal}ms)`);
    return json(response);
  } catch (err) {
    log.error(`Chyba koláže: ${err instanceof Error ? err.stack || err.message : String(err)}`);
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/**
 * Validate minimal request shape and template-specific rules.
 */
function validateCollageRequest(body: CollageRequest) {
  if (!body.items || body.items.length < 2) {
    throw new Error(COLLAGE_MESSAGES.MIN_IMAGES);
  }
  if (body.template === "grid-2x2" && body.items.length < 4) {
    throw new Error(COLLAGE_MESSAGES.GRID_MIN_IMAGES);
  }
  if (
    (body.template === "grid-2-3" ||
      body.template === "grid-3-2" ||
      body.template === "sidebar-grid") &&
    body.items.length < 5
  ) {
    throw new Error(COLLAGE_MESSAGES.TEMPLATE_MIN_IMAGES(body.template, 5));
  }
}

/**
 * Resolve image IDs to actual filesystem paths.
 * Searches multiple candidate locations and common extensions.
 * Collects attempted paths for error reporting when not found.
 */
async function resolveSourcePaths(imageIds: string[], contentDirRoot: string): Promise<string[]> {
  const resolved: string[] = [];

  for (const id of imageIds) {
    const attemptedPaths: string[] = [];
    let fullPath = path.join(contentDirRoot, id);

    if (path.extname(id)) {
      try {
        attemptedPaths.push(fullPath);
        await fs.access(fullPath);
        resolved.push(fullPath);
        continue;
      } catch {
        const picsPath = path.join(contentDirRoot, "pics", id);
        try {
          attemptedPaths.push(picsPath);
          await fs.access(picsPath);
          resolved.push(picsPath);
          continue;
        } catch {
          const sourcesPath = path.join(contentDirRoot, "collage-sources", id);
          try {
            attemptedPaths.push(sourcesPath);
            await fs.access(sourcesPath);
            resolved.push(sourcesPath);
            continue;
          } catch {
            const picsSourcesPath = path.join(contentDirRoot, "pics", "collage-sources", id);
            try {
              attemptedPaths.push(picsSourcesPath);
              await fs.access(picsSourcesPath);
              resolved.push(picsSourcesPath);
              continue;
            } catch {
              const errorMsg = `${COLLAGE_MESSAGES.IMAGE_NOT_FOUND(id)}\nHledáno v: ${attemptedPaths.join(", ")}`;
              log.error(`[Collage] ${errorMsg}`);
              throw new Error(errorMsg);
            }
          }
        }
      }
    }

    // When ID has no extension, try common image extensions in several locations.
    const extensions = [
      ".jpg",
      ".jpeg",
      ".JPG",
      ".JPEG",
      ".png",
      ".PNG",
      ".heic",
      ".HEIC",
      ".heif",
      ".HEIF",
    ];

    const searchPaths = [
      fullPath,
      path.join(contentDirRoot, "pics", id),
      path.join(contentDirRoot, "collage-sources", id),
      path.join(contentDirRoot, "pics", "collage-sources", id),
    ];

    let found = false;
    for (const basePath of searchPaths) {
      for (const ext of extensions) {
        const testPath = basePath + ext;
        attemptedPaths.push(testPath);
        try {
          await fs.access(testPath);
          fullPath = testPath;
          found = true;
          break;
        } catch {
          // continue trying
        }
      }
      if (found) break;
    }

    if (!found) {
      const errorMsg = `${COLLAGE_MESSAGES.IMAGE_NOT_FOUND(id)}\nHledáno v: ${attemptedPaths.join(", ")}`;
      log.error(`[Collage] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    resolved.push(fullPath);
  }

  return resolved;
}

/**
 * Sort paths by EXIF DateTimeOriginal or CreateDate, oldest first.
 */
async function sortByDateTimeOriginal(paths: string[]): Promise<string[]> {
  async function resolveDate(p: string) {
    const tags = await exiftool.read(p);
    const dateStr =
      tags.DateTimeOriginal?.toString() || tags.CreateDate?.toString() || "9999-99-99";
    return { path: p, date: dateStr };
  }

  const withDates = await Promise.all(paths.map(resolveDate));

  function compareDates(a: { date: string }, b: { date: string }) {
    return a.date.localeCompare(b.date);
  }

  function getPath(w: { path: string }) {
    return w.path;
  }

  withDates.sort(compareDates);
  return withDates.map(getPath);
}

/**
 * Scale the entire layout down if any placement would cause an upscaling of its source.
 * This preserves source-image quality by avoiding upscaling.
 */
function applyQualityScale(layout: SharedLayout<LayoutItem>): SharedLayout<LayoutItem> {
  let minScaleFactor = 1.0;

  for (const p of layout.placements) {
    if (!p.crop?.scale) continue;

    const userZoom = p.crop.scale;
    if (userZoom <= 1.0) continue;

    const scaleW = p.width / (p.item.width || 1);
    const scaleH = p.height / (p.item.height || 1);
    const baseScale = Math.max(scaleW, scaleH);
    const finalScale = baseScale * userZoom;

    if (finalScale > 1.0) {
      const requiredShrink = 1.0 / finalScale;
      minScaleFactor = Math.min(minScaleFactor, requiredShrink);
    }
  }

  if (minScaleFactor >= 1.0) return layout;

  log.debug(`Škálování pro zachování kvality: ${(minScaleFactor * 100).toFixed(1)}%`);

  layout.width = Math.round(layout.width * minScaleFactor);
  layout.height = Math.round(layout.height * minScaleFactor);

  for (const p of layout.placements) {
    p.x = Math.round(p.x * minScaleFactor);
    p.y = Math.round(p.y * minScaleFactor);
    p.width = Math.round(p.width * minScaleFactor);
    p.height = Math.round(p.height * minScaleFactor);
  }

  return layout;
}

/**
 * Reduce layout to fit within a maximum dimension (8K), scaling placements accordingly.
 */
function applyMaxDimensionLimit(layout: SharedLayout<LayoutItem>): SharedLayout<LayoutItem> {
  const MAX_DIMENSION = 8000;

  if (layout.width <= MAX_DIMENSION && layout.height <= MAX_DIMENSION) {
    return layout;
  }

  const scale = MAX_DIMENSION / Math.max(layout.width, layout.height);

  log.warn(
    `[Collage] Zmenšování z ${layout.width}x${layout.height} na 8K limit (${(scale * 100).toFixed(1)}%)`,
  );

  layout.width = Math.round(layout.width * scale);
  layout.height = Math.round(layout.height * scale);

  for (const p of layout.placements) {
    p.x = Math.round(p.x * scale);
    p.y = Math.round(p.y * scale);
    p.width = Math.round(p.width * scale);
    p.height = Math.round(p.height * scale);
  }

  return layout;
}

/**
 * Adjust layout dimensions to match a target aspect ratio by expanding the canvas.
 * The content is centered within the new bounds.
 */
/**
 * Adjust layout dimensions to match a target aspect ratio by stretching images.
 * Unlike simple scaling, this logic preserves fixed borders and gutters (no dynamics).
 */
function applyAspectRatio(
  layout: SharedLayout<LayoutItem>,
  ratioId: string,
): SharedLayout<LayoutItem> {
  const [wRatio, hRatio] = ratioId.split(":").map(Number);
  if (!wRatio || !hRatio) return layout;

  const targetRatio = wRatio / hRatio;
  const currentRatio = layout.width / layout.height;

  if (Math.abs(currentRatio - targetRatio) < 0.01) return layout;

  // Clone layout and placements to avoid side-effects
  const newLayout: SharedLayout<LayoutItem> = {
    ...layout,
    placements: layout.placements.map((p) => ({ ...p })),
  };

  if (currentRatio > targetRatio) {
    // Current is wider than target -> Increase Height (Stretch Y)
    const newTotalHeight = Math.round(layout.width / targetRatio);
    stretchDimension(newLayout, "y", newTotalHeight);
    log.info(
      `[Collage] Enforcing ${ratioId} ratio: Stretched height to ${newTotalHeight}px (fixed borders)`,
    );
  } else {
    // Current is taller than target -> Increase Width (Stretch X)
    const newTotalWidth = Math.round(layout.height * targetRatio);
    stretchDimension(newLayout, "x", newTotalWidth);
    log.info(
      `[Collage] Enforcing ${ratioId} ratio: Stretched width to ${newTotalWidth}px (fixed borders)`,
    );
  }

  return newLayout;
}

/**
 * Stretches a layout along one axis while keepings gaps (gutters/margins) fixed.
 * Only segments of the axis occupied by image content are scaled.
 */
function stretchDimension(layout: SharedLayout<LayoutItem>, axis: "x" | "y", targetTotal: number) {
  const posKey = axis === "x" ? "x" : "y";
  const dimKey = axis === "x" ? "width" : "height";
  const oldTotal = layout[dimKey];
  if (oldTotal === targetTotal) return;

  // 1. Identify Content Intervals along the axis
  const rawIntervals = layout.placements.map((p) => [p[posKey], p[posKey] + p[dimKey]]);
  rawIntervals.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  if (rawIntervals.length > 0) {
    let curr = rawIntervals[0];
    for (let i = 1; i < rawIntervals.length; i++) {
      // Tiny epsilon to bridge sub-pixel rounding gaps if any
      if (rawIntervals[i][0] <= curr[1] + 0.1) {
        curr[1] = Math.max(curr[1], rawIntervals[i][1]);
      } else {
        merged.push([curr[0], curr[1]]);
        curr = rawIntervals[i];
      }
    }
    merged.push([curr[0], curr[1]]);
  }

  const oldContentSum = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
  const totalChange = targetTotal - oldTotal;

  if (oldContentSum <= 0) {
    layout[dimKey] = targetTotal;
    return;
  }

  const scale = (oldContentSum + totalChange) / oldContentSum;

  /**
   * Transforms a coordinate by scaling only the parts that fall within content intervals.
   */
  const transform = (v: number) => {
    let newV = 0;
    let lastE = 0;
    let contentProcessed = 0;

    for (const [s, e] of merged) {
      // Add the gap before this interval (unscaled)
      newV += s - lastE;
      if (v <= s) return newV - (s - v);

      const segmentLen = e - s;
      const progressInSegment = Math.min(v - s, segmentLen);

      // Add scaled progress
      const scaledSegmentStart = contentProcessed * scale;
      const scaledProgress = (contentProcessed + progressInSegment) * scale - scaledSegmentStart;

      if (v <= e) {
        return newV + scaledProgress;
      }

      newV += segmentLen * scale;
      contentProcessed += segmentLen;
      lastE = e;
    }

    // Add final gap (unscaled)
    newV += oldTotal - lastE;
    return newV - (oldTotal - v);
  };

  for (const p of layout.placements) {
    const s = p[posKey];
    const e = p[posKey] + p[dimKey];
    const newS = transform(s);
    const newE = transform(e);

    p[posKey] = Math.round(newS);
    p[dimKey] = Math.round(newE - newS);
  }

  layout[dimKey] = targetTotal;
}

/**
 * Render the collage: load, crop/resize each placement and composite onto a canvas.
 *
 * Notes on cropping math:
 * - finalScale = baseScale * userScale determines the working raster size.
 * - We compute the extract area in source pixels by dividing viewport by finalScale.
 * - left/top are derived from user crop percentages and clamped to valid ranges.
 */

/**
 * Persist collage buffer to disk.
 */
async function saveCollageImage(buffer: Buffer, outputPath: string) {
  await fs.writeFile(outputPath, buffer);
}

/**
 * Copy EXIF and attach a custom Software tag, using source as metadata donor.
 */
async function copyMetadataFromSource(
  sourcePath: string,
  targetPath: string,
  _sourceNames: string,
) {
  await exiftool.write(
    targetPath,
    {
      Software: COLLAGE_MESSAGES.SOFTWARE_LABEL,
    },
    ["-TagsFromFile", sourcePath, "-all:all", "-unsafe", "-icc_profile"],
  );
}

/**
 * Move original source images into collage-sources preserving relative paths.
 */
async function moveSourceImages(sourcePaths: string[], contentDirRoot: string, imageIds: string[]) {
  const sourcesDir = path.join(contentDirRoot, "collage-sources");

  for (let i = 0; i < sourcePaths.length; i++) {
    const src = sourcePaths[i];
    const imageId = imageIds[i];

    const destPath = path.join(sourcesDir, imageId);
    const destDir = path.dirname(destPath);

    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(src, destPath);
  }
}

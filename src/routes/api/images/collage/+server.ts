import fs from "node:fs/promises";
import path from "node:path";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import sharp from "sharp";
import { getContentDir } from "$lib/config";
import type { Logger } from "$lib/logger";
import { clearTaskStatus, saveTaskStatus } from "$lib/server/task-status";
import type { CollageItemConfig, CollageRequest, CollageResponse } from "$lib/types/collage";
import { calculateLayout } from "$lib/utils/collage-layout-engine";
import { renderCollage } from "$lib/utils/collage-renderer";
import { reloadManifests } from "$lib/utils/manifest-loader";
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
    movedPath: path.join("pics", "collage-sources", imageIds[idx]),
  };
}

/**
 * Main POST handler for creating a collage.
 * Validates request, resolves source files, computes layout, renders collage,
 * copies EXIF, moves sources and updates manifests.
 */
export async function POST({ request, locals }: RequestEvent): Promise<Response> {
  const { log, logContext } = locals;

  if (!IS_DEV) {
    return json({ success: false, error: COLLAGE_MESSAGES.DEV_ONLY }, { status: 403 });
  }

  const contentDirName = getContentDir();
  const dataPath = path.join(process.cwd(), "src/data", contentDirName);

  // Set task status before starting
  await saveTaskStatus(dataPath, {
    id: "collage-generation",
    label: "Vytváření koláže...",
  });

  try {
    const startTotal = Date.now();

    const body = (await request.json()) as CollageRequest;
    log.info({ requestBody: body }, "Collage API: Received request");
    validateCollageRequest(body);

    const contentDirRoot = path.join(process.cwd(), "content", contentDirName);

    // Resolve source paths for requested image IDs.
    const imageIds = body.items.map(mapImageId);
    log.info({ imageIds }, "Collage API: Resolving paths for IDs");
    const sourcePaths = await resolveSourcePaths(imageIds, contentDirRoot, log);
    log.info({ sourcePaths }, "Collage API: Resolved source paths");

    // Choose metadata source by EXIF date (oldest).
    const startSort = Date.now();
    const sortedByTime = await sortByDateTimeOriginal(sourcePaths);
    log.debug({ sortDuration: Date.now() - startSort }, "Collage: Seřazení podle EXIF");
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
    log.debug({ metaDuration: Date.now() - startMeta }, "Collage: Načtení metadat");

    // Layout calculation with quality scaling, aspect ratio and max dimension limit handled by engine.
    const finalLayout = calculateLayout(imageMetas, body.template, {
      border: body.border ?? { width: 0 },
      cropStrategy: "simple",
      aspectRatio: body.aspectRatio,
      maxDimension: 8000,
    });

    // Render collage to a JPEG buffer.
    const startRender = Date.now();
    const buffer = await renderCollage(
      finalLayout,
      body.border ?? { width: 0 },
      body.background ?? { style: "color", color: "#ffffff" },
    );
    log.info({ renderDuration: Date.now() - startRender }, "Collage: Renderování dokončeno");

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
    log.info({ configPath, config: configWithPaths }, "Collage API: Saving configuration");
    await fs.writeFile(configPath, JSON.stringify(configWithPaths, null, 2));

    // Copy EXIF metadata from chosen source image into the collage.
    const startExif = Date.now();
    function getBasename(p: string) {
      return path.basename(p);
    }
    const sourceNames = sourcePaths.map(getBasename).join(", ");
    await copyMetadataFromSource(metadataSourcePath, outputPath, sourceNames);
    log.debug({ exifDuration: Date.now() - startExif }, "Collage: Kopírování EXIF");

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
      log.info({ people: processResult.image.people }, "Collage: Inherited people");

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
      const menuManifest = generateMenuManifest(updatedManifest, storyData);
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

    log.info({ postDuration: Date.now() - startPost }, "Collage: Post-processing dokončeno");

    const response: CollageResponse = {
      success: true,
      outputPath: outputFilename,
    };

    logContext.outputPath = outputFilename;
    logContext.totalDuration = Date.now() - startTotal;
    log.info({ outputFilename, totalDuration: Date.now() - startTotal }, "Collage: Úspěch");
    return json(response);
  } catch (err) {
    log.error({ err }, "Chyba koláže");
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await clearTaskStatus(dataPath);
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
async function resolveSourcePaths(
  imageIds: string[],
  contentDirRoot: string,
  log: Logger,
): Promise<string[]> {
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
          const sourcesPath = path.join(contentDirRoot, "pics", "collage-sources", id);
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
              log.error({ id, attemptedPaths }, "Collage: Image not found");
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
      path.join(contentDirRoot, "pics", "collage-sources", id),
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
      log.error({ id, attemptedPaths }, "Collage: Image not found (no extension)");
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
  // Step 1: Copy all metadata EXCEPT Orientation from source
  await exiftool.write(
    targetPath,
    {
      Software: COLLAGE_MESSAGES.SOFTWARE_LABEL,
    },
    ["-TagsFromFile", sourcePath, "-all:all", "--Orientation", "-unsafe", "-icc_profile"],
  );

  // Step 2: Explicitly set Orientation to 1 (Horizontal/normal)
  // This prevents Sharp from applying any rotation when generating previews
  await exiftool.write(targetPath, { Orientation: 1 } as import("exiftool-vendored").WriteTags, [
    "-overwrite_original",
  ]);
}

/**
 * Move original source images into collage-sources preserving relative paths.
 */
async function moveSourceImages(sourcePaths: string[], contentDirRoot: string, imageIds: string[]) {
  const sourcesDir = path.join(contentDirRoot, "pics", "collage-sources");

  for (let i = 0; i < sourcePaths.length; i++) {
    const src = sourcePaths[i];
    const imageId = imageIds[i];

    const destPath = path.join(sourcesDir, imageId);
    const destDir = path.dirname(destPath);

    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(src, destPath);
  }
}

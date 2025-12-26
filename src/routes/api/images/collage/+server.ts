import fs from "node:fs/promises";
import path from "node:path";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import sharp from "sharp";
import { getContentDir } from "$lib/config";
import { log } from "$lib/logger";
import type {
  CollageBorder,
  CollageItemConfig,
  CollageRequest,
  CollageResponse,
} from "$lib/types/collage";
import {
  calculateLayout,
  type LayoutItem,
  type SharedLayout,
} from "$lib/utils/collage-layout-engine";
import { COLLAGE_MESSAGES } from "$lib/utils/messages";

// DEV-ONLY GUARD
const IS_DEV = import.meta.env.DEV;

// Helper for map()
function mapImageId(item: CollageItemConfig): string {
  return item.imageId;
}

// Helper for map()
function mapConfigItem(item: CollageItemConfig, idx: number, imageIds: string[]) {
  return {
    ...item,
    originalPath: imageIds[idx],
    movedPath: path.join("collage-sources", imageIds[idx]),
  };
}

export async function POST({ request }: RequestEvent): Promise<Response> {
  if (!IS_DEV) {
    return json({ success: false, error: COLLAGE_MESSAGES.DEV_ONLY }, { status: 403 });
  }

  try {
    const startTotal = Date.now();

    const body = (await request.json()) as CollageRequest;
    validateCollageRequest(body);

    const contentDirName = getContentDir();
    const contentDirRoot = path.join(process.cwd(), "content", contentDirName);

    // 1. Resolve paths
    const imageIds = body.items.map(mapImageId);
    const sourcePaths = await resolveSourcePaths(imageIds, contentDirRoot);

    // 2. Sort by time for metadata source
    // 2. Sort by time for metadata source
    const startSort = Date.now();
    const sortedByTime = await sortByDateTimeOriginal(sourcePaths);
    log.debug(`[Collage] Seřazení podle EXIF: ${Date.now() - startSort}ms`);
    const metadataSourcePath = sortedByTime[0];

    // 3. Get image metadata (dimensions for layout) + bind config

    // 3. Get image metadata (dimensions for layout) + bind config
    const startMeta = Date.now();

    // Helper for map/Promise.all
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

    // 4. Calculate layout
    const layout = calculateLayout(
      imageMetas,
      body.template,
      body.border ?? { width: 0, color: "#fff" },
    );

    // 5. Apply Quality-First Scaling (prevent upscale)
    let finalLayout = applyQualityScale(layout);

    // 6. Apply 8K dimension limit
    finalLayout = applyMaxDimensionLimit(finalLayout);

    // 7. Render collage
    // 7. Render collage
    const startRender = Date.now();
    const buffer = await renderCollage(finalLayout, body.border);
    log.info(`[Collage] Renderování dokončeno: ${Date.now() - startRender}ms`);

    // 7. Save to disk (in pics/ directory)
    const ext = path.extname(metadataSourcePath);
    const basename = path.basename(metadataSourcePath, ext);
    const outputFilename = `pics/${basename}--collage.jpg`;
    const outputPath = path.join(contentDirRoot, outputFilename);

    // Ensure pics/ directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await saveCollageImage(buffer, outputPath);

    // 8. Save Configuration Sidecar with Path Tracking
    const configPath = path.join(contentDirRoot, `pics/${basename}--collage.json`);

    // Helper closure for map
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
    await fs.writeFile(configPath, JSON.stringify(configWithPaths, null, 2));

    // 9. Copy metadata
    const startExif = Date.now();

    function getBasename(p: string) {
      return path.basename(p);
    }
    const sourceNames = sourcePaths.map(getBasename).join(", ");

    await copyMetadataFromSource(metadataSourcePath, outputPath, sourceNames);
    log.debug(`[Collage] Kopírování EXIF: ${Date.now() - startExif}ms`);

    // 10. Move source images (preserve directory structure)
    await moveSourceImages(sourcePaths, contentDirRoot, imageIds);

    const response: CollageResponse = {
      success: true,
      outputPath: outputFilename,
    };

    log.info(`[Collage] Úspěch: ${outputFilename} (Celkem: ${Date.now() - startTotal}ms)`);
    return json(response);
  } catch (err) {
    log.error(`Chyba koláže: ${err instanceof Error ? err.message : String(err)}`);
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function validateCollageRequest(body: CollageRequest) {
  if (!body.items || body.items.length < 2) {
    throw new Error(COLLAGE_MESSAGES.MIN_IMAGES);
  }
  if (body.template === "grid-2x2" && body.items.length < 4) {
    throw new Error(COLLAGE_MESSAGES.GRID_MIN_IMAGES);
  }
}

async function resolveSourcePaths(imageIds: string[], contentDirRoot: string): Promise<string[]> {
  const resolved: string[] = [];

  for (const id of imageIds) {
    const attemptedPaths: string[] = [];

    // Build full path
    let fullPath = path.join(contentDirRoot, id);

    // If already has extension, check if exists
    if (path.extname(id)) {
      try {
        attemptedPaths.push(fullPath);
        await fs.access(fullPath);
        resolved.push(fullPath);
        continue;
      } catch {
        // Try in pics/ subdirectory
        const picsPath = path.join(contentDirRoot, "pics", id);
        try {
          attemptedPaths.push(picsPath);
          await fs.access(picsPath);
          resolved.push(picsPath);
          continue;
        } catch {
          // Try in collage-sources/ (for re-editing)
          const sourcesPath = path.join(contentDirRoot, "collage-sources", id);
          try {
            attemptedPaths.push(sourcesPath);
            await fs.access(sourcesPath);
            resolved.push(sourcesPath);
            continue;
          } catch {
            const errorMsg = `${COLLAGE_MESSAGES.IMAGE_NOT_FOUND(id)}\nHledáno v: ${attemptedPaths.join(", ")}`;
            log.error(`[Collage] ${errorMsg}`);
            throw new Error(errorMsg);
          }
        }
      }
    }

    // No extension - try common image extensions
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
    let found = false;

    for (const ext of extensions) {
      const testPath = fullPath + ext;
      attemptedPaths.push(testPath);
      try {
        await fs.access(testPath);
        fullPath = testPath;
        found = true;
        break;
      } catch {
        // File doesn't exist with this extension
      }
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

async function renderCollage(
  layout: SharedLayout<LayoutItem>,
  border?: CollageBorder,
): Promise<Buffer> {
  log.debug(`[Collage] Velikost plátna: ${layout.width}x${layout.height}`);
  log.debug(`[Collage] Zpracování ${layout.placements.length} obrázků`);

  async function processPlacement(p: (typeof layout.placements)[0], _idx: number) {
    const pipeline = sharp(p.item.path); // Use item.path

    if (p.crop) {
      const meta = await pipeline.metadata();
      const inW = meta.width ?? 0;
      const inH = meta.height ?? 0;

      if (inW === 0 || inH === 0) {
        throw new Error(COLLAGE_MESSAGES.INVALID_DIMENSIONS(p.item.path ?? "unknown"));
      }

      const scaleW = p.width / inW;
      const scaleH = p.height / inH;
      const baseScale = Math.max(scaleW, scaleH);

      const userScale = p.crop.scale ?? 1;
      const finalScale = baseScale * userScale;

      const finalW = Math.round(inW * finalScale);
      const finalH = Math.round(inH * finalScale);

      const viewportW = p.width;
      const viewportH = p.height;

      const maxOffsetX = Math.max(0, finalW - viewportW);
      const maxOffsetY = Math.max(0, finalH - viewportH);

      // p.crop might be undefined in strict null checks but layout engine ensures it?
      // We checked if (p.crop) above.
      const left = Math.round(maxOffsetX * (p.crop.x / 100));
      const top = Math.round(maxOffsetY * (p.crop.y / 100));

      const extractW = Math.min(inW, Math.round(viewportW / finalScale));
      const extractH = Math.min(inH, Math.round(viewportH / finalScale));
      const extractLeft = Math.min(inW - extractW, Math.round(left / finalScale));
      const extractTop = Math.min(inH - extractH, Math.round(top / finalScale));

      pipeline
        .extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH })
        .resize(p.width, p.height, { fit: "fill" });
    } else {
      pipeline.resize(p.width, p.height, { fit: "cover" });
    }

    const buffer = await pipeline.toBuffer();

    return {
      input: buffer,
      top: p.y,
      left: p.x,
    };
  }

  const resizedInputs = await Promise.all(layout.placements.map(processPlacement));

  const background = border?.color || "#ffffff";

  const result = await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 3,
      background: background,
    },
  })
    .composite(resizedInputs)
    .jpeg({ quality: 98, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return result;
}

async function saveCollageImage(buffer: Buffer, outputPath: string) {
  await fs.writeFile(outputPath, buffer);
}

async function copyMetadataFromSource(sourcePath: string, targetPath: string, sourceNames: string) {
  await exiftool.write(
    targetPath,
    {
      UserComment: COLLAGE_MESSAGES.USER_COMMENT(sourceNames),
      ImageDescription: COLLAGE_MESSAGES.USER_COMMENT(sourceNames),
      Software: COLLAGE_MESSAGES.SOFTWARE_LABEL,
    },
    ["-TagsFromFile", sourcePath, "-all:all", "-unsafe", "-icc_profile"],
  );
}

async function moveSourceImages(sourcePaths: string[], contentDirRoot: string, imageIds: string[]) {
  const sourcesDir = path.join(contentDirRoot, "pics", "collage-sources");

  for (let i = 0; i < sourcePaths.length; i++) {
    const src = sourcePaths[i];
    const imageId = imageIds[i];

    // Preserve directory structure (e.g., pics/image.heic -> collage-sources/pics/image.heic)
    const destPath = path.join(sourcesDir, imageId);
    const destDir = path.dirname(destPath);

    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true });

    // Move file
    await fs.rename(src, destPath);
  }
}

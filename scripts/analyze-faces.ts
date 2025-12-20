import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { intro, outro } from "@clack/prompts";
import { detectFaces } from "./lib/face-detection";
import { resolveGalleryDirectory } from "./lib/gallery-resolver";
import { createLogger } from "./lib/logger";
import { loadImagesManifest, saveImagesManifest } from "./lib/manifest-repository";
import { run } from "./lib/shell-utils";

const logger = createLogger("analyze-faces");

async function convertHeicIfNeeded(
  absPath: string,
  baseName: string,
): Promise<{ processingPath: string; tempFilePath: string | null }> {
  const ext = path.extname(absPath).slice(1).toLowerCase();
  if (ext === "heic" || ext === "heif") {
    const tmpDir = os.tmpdir();
    const tempFilePath = path.join(tmpDir, `${baseName}_converted.jpg`);
    try {
      // Try vips first if available (matches image-processor)
      await run("vips", ["copy", absPath, tempFilePath]);
      return { processingPath: tempFilePath, tempFilePath };
    } catch (vipsErr) {
      try {
        // Fallback to sips (macOS)
        await run("sips", ["-s", "format", "jpeg", absPath, "--out", tempFilePath]);
        return { processingPath: tempFilePath, tempFilePath };
      } catch (sipsErr) {
        logger.warn(`Failed to convert HEIC for ${absPath}: ${vipsErr} | ${sipsErr}`);
        return { processingPath: absPath, tempFilePath: null };
      }
    }
  }
  return { processingPath: absPath, tempFilePath: null };
}

async function main() {
  intro("🔍 Face Analysis & Detection");

  const contentDir = await resolveGalleryDirectory();
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const srcRoot = path.resolve(process.cwd(), `content/${contentDir}`);

  const manifest = await loadImagesManifest(dataDir);
  if (!manifest) {
    logger.error(`Manifest not found in ${dataDir}`);
    process.exit(1);
  }

  let processedCount = 0;
  let faceCount = 0;
  const changedImages: string[] = [];

  logger.info("Scanning for images requiring face detection...");

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const image = item;

        // Skip if already detected
        if (image.analysis?.facesDetected) {
          continue;
        }

        // Initialize analysis if missing
        if (!image.analysis) {
          image.analysis = {
            sharpness: 0,
            phash: "",
            embedding: [],
            facesDetected: false,
          };
        }

        const absPath = path.join(srcRoot, "pics", path.basename(image.src));

        try {
          // Check if file exists
          await fs.access(absPath);

          const { processingPath, tempFilePath } = await convertHeicIfNeeded(
            absPath,
            path.basename(absPath, path.extname(absPath)),
          );

          try {
            // Let's import sharp just for resizing to detection size
            const sharp = (await import("sharp")).default;
            // Ensure we output JPEG compatible buffer for face-api
            const buffer = await sharp(processingPath)
              .resize({ width: 800, withoutEnlargement: true })
              .toFormat("jpeg")
              .toBuffer();

            const detected = await detectFaces(buffer);

            const meta = await sharp(buffer).metadata();
            const originalMeta = await sharp(absPath).metadata();

            const scale = (originalMeta.width || 1) / (meta.width || 1);

            const faces = detected.map((b) => ({
              x: b.x * scale,
              y: b.y * scale,
              width: b.width * scale,
              height: b.height * scale,
            }));

            // Update manifest
            if (faces.length > 0) {
              faceCount += faces.length;
              image.analysis.faces = faces;
              logger.verbose(`Detected ${faces.length} faces in ${image.id}`);
            }

            // Always mark as detected so we don't retry immediately?
            // Or only if we successfully analyzed?
            image.analysis.facesDetected = true;

            processedCount++;
            changedImages.push(image.id);
          } finally {
            if (tempFilePath) {
              try {
                await fs.unlink(tempFilePath);
              } catch {}
            }
          }
        } catch (e) {
          logger.error(`Failed to analyze ${image.id}:`, e);
        }
      }
    }
  }

  if (changedImages.length > 0) {
    await saveImagesManifest(dataDir, manifest);
    logger.info(`Analyzed ${processedCount} images. Found ${faceCount} faces.`);
  } else {
    logger.info("No new images to analyze.");
  }

  outro("Done");
}

main().catch(console.error);

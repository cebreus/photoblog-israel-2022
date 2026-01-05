import path from "node:path";
import { error } from "@sveltejs/kit";
import sharp from "sharp";
import { createLogger } from "$lib/logger";
import { readClapFromFile } from "$scripts/lib/image/clap-parser";
import { fileExists, scanGlob } from "$scripts/lib/utils/runtime";
import type { RequestHandler } from "./$types";

const logger = createLogger("clap-preview");

export const GET: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get("id");
  const contentDir = url.searchParams.get("contentDir");

  if (!id || !contentDir) {
    throw error(400, "Missing id or contentDir");
  }

  try {
    const rootContentDir = path.join(process.cwd(), "content", contentDir);
    let absPath = path.join(rootContentDir, id);

    // If exact path doesn't exist, try to find it
    if (!(await fileExists(absPath))) {
      // Try to find the file recursively
      // We look for strict id match or id.* (for extensions)
      const matches = await scanGlob(`**/${id}{,.*}`, {
        cwd: rootContentDir,
        absolute: true,
      });

      if (matches.length > 0) {
        absPath = matches[0];
      }

      if (!(await fileExists(absPath))) {
        throw error(404, `Input file is missing: ${id} in ${contentDir}`);
      }
    }

    // 1. Get Metadata
    const sharpInstance = sharp(absPath);
    const metadata = await sharpInstance.metadata();

    if (!metadata.width || !metadata.height) {
      throw error(500, "Could not read image dimensions");
    }

    // 2. Read existing clap data
    // Priority 1: Manifest (allows persistence even if file is read-only)
    let clap = null;
    try {
      const dataPath = path.resolve(process.cwd(), "src/data", contentDir);
      const { loadImagesManifest } = await import("$scripts/lib/manifests/repository");
      const { isImageEntry } = await import("$lib/types/manifest");
      const manifest = await loadImagesManifest(dataPath);
      if (manifest) {
        for (const day of manifest.photoDays) {
          const item = day.items.find((i) => i.id === id);
          if (item && isImageEntry(item) && item.clap) {
            clap = item.clap;
            break;
          }
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "Failed to check manifest for clap");
    }

    // Priority 2: Physical file
    if (!clap) {
      clap = await readClapFromFile(absPath);
    }

    // If metadata-only request, return JSON
    if (url.searchParams.get("metadata") === "true") {
      return new Response(
        JSON.stringify({
          nativeWidth: metadata.width,
          nativeHeight: metadata.height,
          orientation: metadata.orientation || 1,
          initialClap: clap,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 3. Generate a small preview for the editor
    // We want the original aspect ratio but manageable size (e.g. 1200px max)
    const buffer = await sharpInstance
      .resize(1200, 1200, { fit: "inside" })
      .toFormat("jpeg", { quality: 85 })
      .toBuffer();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Native-Width": String(metadata.width),
        "X-Native-Height": String(metadata.height),
        "X-Exif-Orientation": String(metadata.orientation || 1),
        "X-Clap-Data": clap ? JSON.stringify(clap) : "",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error({ err: e, imageId: id }, "Preview generation failed");
    throw error(500, message);
  }
};

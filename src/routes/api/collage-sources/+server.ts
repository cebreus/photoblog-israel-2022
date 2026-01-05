import fs from "node:fs/promises";
import path from "node:path";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import sharp from "sharp";
import { getContentDir } from "$lib/config";

/**
 * GET /api/collage-sources?ids=id1,id2,id3
 * Returns metadata for collage source images that have been moved to collage-sources/
 */
export async function GET({ url, locals }: RequestEvent): Promise<Response> {
  const { log, logContext } = locals;
  const idsParam = url.searchParams.get("ids");

  if (!idsParam) {
    return json({ error: "Missing 'ids' parameter" }, { status: 400 });
  }

  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return json({ error: "No valid IDs provided" }, { status: 400 });
  }

  try {
    const contentDir = getContentDir();
    const contentRoot = path.join(process.cwd(), "content", contentDir);
    const sourcesDir = path.join(contentRoot, "pics", "collage-sources");

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          // Try common extensions
          const extensions = [".heic", ".jpg", ".jpeg", ".png", ".HEIC", ".JPG", ".JPEG", ".PNG"];

          for (const ext of extensions) {
            const filePath = path.join(sourcesDir, `${id}${ext}`);

            try {
              await fs.access(filePath);
              // File exists, get metadata
              const metadata = await sharp(filePath).metadata();

              return {
                id,
                width: metadata.width || 1000,
                height: metadata.height || 1000,
                format: metadata.format,
              };
            } catch {
              // Try next extension
            }
          }

          // Not found with any extension
          log.warn({ id }, "CollageSource: Image not found");
          return {
            id,
            width: 1000,
            height: 1000,
            format: "jpeg",
            error: "not_found",
          };
        } catch (error) {
          log.error({ err: error, id }, "CollageSource: Error loading image");
          return {
            id,
            width: 1000,
            height: 1000,
            format: "jpeg",
            error: String(error),
          };
        }
      }),
    );

    logContext.collageSourcesCount = results.length;
    return json({ sources: results });
  } catch (error) {
    log.error({ err: error }, "CollageSource: API error");
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

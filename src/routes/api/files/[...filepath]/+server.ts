import { getContentDir } from "$lib/config";
import { fileExists, readFileBuffer } from "$scripts/utils/runtime";
import { isHeic, MIME_TYPES } from "$shared/types/images";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const IS_DEV = import.meta.env.DEV;

export async function GET({ params, locals }: RequestEvent): Promise<Response> {
  const { log } = locals;

  if (!IS_DEV) {
    // No need to log this, it's a hard security constraint
    return json({ error: "File access only available in dev mode" }, { status: 403 });
  }

  try {
    const filepath = params.filepath || "";
    const contentDirName = getContentDir();
    const contentDirRoot = path.join(process.cwd(), "content", contentDirName);
    const fullPath = path.join(contentDirRoot, filepath);

    // Security: Ensure path is within content directory
    if (!fullPath.startsWith(contentDirRoot)) {
      log.warn({ filepath, fullPath, contentDirRoot }, "Path traversal attempt blocked");
      return json({ error: "Invalid path" }, { status: 403 });
    }

    if (!(await fileExists(fullPath))) {
      // Common event in dev (broken image links), debug level sufficient usually,
      // but warn if we want to track missing assets
      log.debug({ filepath }, "File not found");
      return json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await readFileBuffer(fullPath);

    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext.toLowerCase()] || "application/octet-stream";

    if (isHeic(ext)) {
      // Browser doesn't support HEIC natively, convert to JPEG for preview
      const buffer = await sharp(fullPath).jpeg({ quality: 90 }).toBuffer();
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "max-age=3600",
        },
      });
    }

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "max-age=3600",
      },
    });
  } catch (err) {
    log.error({ err, params }, "File read error");
    return json({ error: String(err) }, { status: 500 });
  }
}

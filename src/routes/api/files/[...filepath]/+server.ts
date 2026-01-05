import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import sharp from "sharp";
import { getContentDir } from "$lib/config";

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

    try {
      await fs.access(fullPath);
    } catch {
      // Common event in dev (broken image links), debug level sufficient usually,
      // but warn if we want to track missing assets
      log.debug({ filepath }, "File not found");
      return json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(fullPath);

    const ext = path.extname(fullPath).toLowerCase();
    let contentType = "application/octet-stream";

    if (ext === ".heic") {
      // Browser doesn't support HEIC natively, convert to JPEG for preview
      const buffer = await sharp(fullPath).jpeg({ quality: 90 }).toBuffer();
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "max-age=3600",
        },
      });
    }

    if (ext === ".json") contentType = "application/json";
    else if (ext === ".md") contentType = "text/markdown";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".avif") contentType = "image/avif";

    return new Response(fileBuffer, {
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

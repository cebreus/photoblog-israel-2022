import fs from "node:fs/promises";
import path from "node:path";
import type { RequestEvent } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { getContentDir } from "$lib/config";

const IS_DEV = import.meta.env.DEV;

export async function GET({ params }: RequestEvent): Promise<Response> {
  if (!IS_DEV) {
    return json({ error: "File access only available in dev mode" }, { status: 403 });
  }

  try {
    const filepath = params.filepath || "";
    const contentDirName = getContentDir();
    const contentDirRoot = path.join(process.cwd(), "content", contentDirName);
    const fullPath = path.join(contentDirRoot, filepath);

    // Security: Ensure path is within content directory
    if (!fullPath.startsWith(contentDirRoot)) {
      return json({ error: "Invalid path" }, { status: 403 });
    }

    // Replaced Bun.file with fs.readFile
    let content: string;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch (readError) {
      const error = readError as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return json({ error: "File not found" }, { status: 404 });
      }
      throw readError;
    }

    return new Response(content, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error("File read error:", err);
    return json({ error: String(err) }, { status: 500 });
  }
}

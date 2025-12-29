import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";
import { getContentDir } from "$lib/config";
import { createLogger } from "$lib/logger";

const logger = createLogger("api:people:avatars");

export async function GET() {
  const contentDir = getContentDir();
  const avatarsDir = path.resolve(process.cwd(), "static", contentDir, "assets", "avatars");

  try {
    // Check if directory exists first
    try {
      await fsp.access(avatarsDir);
    } catch {
      return json({ avatars: [] });
    }

    const files = await fsp.readdir(avatarsDir);
    const avatars = files
      .filter((file) => /\.(png|jpg|jpeg|webp|svg)$/i.test(file))
      .map((file) => `assets/avatars/${file}`);

    return json({ avatars });
  } catch (e) {
    logger.warn(`Failed to list avatars in ${avatarsDir}:`, e);
    return json({ avatars: [] });
  }
}

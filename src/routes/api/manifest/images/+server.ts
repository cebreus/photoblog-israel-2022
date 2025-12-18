import { json } from "@sveltejs/kit";
import fsp from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const manifestPath = path.resolve(
    process.cwd(),
    `src/data/${contentDir}/images.manifest.json`,
  );

  try {
    const data = await fsp.readFile(manifestPath, "utf-8");
    return json(JSON.parse(data));
  } catch (error) {
    console.error("Failed to load images manifest:", error);
    return json({ photoDays: [] });
  }
}

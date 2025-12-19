import fsp from "node:fs/promises";
import path from "node:path";
import { json } from "@sveltejs/kit";

export async function GET() {
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const manifestPath = path.resolve(process.cwd(), `src/data/${contentDir}/people.manifest.json`);

  try {
    const data = await fsp.readFile(manifestPath, "utf-8");
    return json(JSON.parse(data));
  } catch (error) {
    console.error("Failed to load people manifest:", error);
    return json({ people: [] });
  }
}

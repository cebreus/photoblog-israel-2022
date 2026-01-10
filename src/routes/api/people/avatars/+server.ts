import { getContentDir } from "$lib/config";
import { fileExists, readdir } from "$scripts/utils/runtime";
import { json } from "@sveltejs/kit";
import path from "node:path";
import process from "node:process";

export async function GET({ locals }: { locals: App.Locals }) {
  const { log } = locals;
  const contentDir = getContentDir();
  const avatarsDir = path.resolve(process.cwd(), `static-${contentDir}`, "assets", "avatars");

  try {
    // Check if directory exists first
    if (!(await fileExists(avatarsDir))) {
      return json({ avatars: [] });
    }

    const files = await readdir(avatarsDir);
    const avatars = files
      .filter((file: string) => /\.(png|jpg|jpeg|webp|svg)$/i.test(file))
      .map((file: string) => `assets/avatars/${file}`);

    return json({ avatars });
  } catch (e) {
    log.warn({ err: e, avatarsDir }, "Failed to list avatars");
    return json({ avatars: [] });
  }
}

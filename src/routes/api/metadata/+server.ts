import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { error, json } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import { dev } from "$app/environment";
import type { ImageEntry, Manifest } from "$lib/types/manifest";
import { getExifToolWriteTags, type MetadataKey } from "$lib/utils/metadata-standards";

function findImageById(manifestData: Manifest, id: string): ImageEntry | undefined {
  for (const day of manifestData.photoDays) {
    const found = day.items.find(
      (item): item is ImageEntry => item.type === "image" && item.id === id,
    );
    if (found) return found;
  }
  return undefined;
}

export async function POST({ request }) {
  if (!dev) {
    throw error(403, "Úprava metadat je povolena pouze v režimu vývoje.");
  }

  const { imageIds, metadata } = await request.json();

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    throw error(400, "Nebyla poskytnuta žádná ID obrázků.");
  }

  const contentDir = process.env.CONTENT_DIR;
  if (!contentDir) {
    throw error(500, "Proměnná prostředí CONTENT_DIR není nastavena.");
  }

  const results = {
    success: [] as string[],
    failed: [] as { id: string; error: string }[],
  };

  const contentRoot = path.resolve(process.cwd(), "content", contentDir);

  const updates: Partial<Record<MetadataKey, string | string[] | null>> = {};

  if (metadata.title !== undefined) updates.title = metadata.title;
  if (metadata.caption !== undefined) updates.caption = metadata.caption;
  if (metadata.city !== undefined) updates.city = metadata.city;
  if (metadata.location !== undefined) updates.location = metadata.location;
  if (metadata.keywords !== undefined) updates.keywords = metadata.keywords;
  if (metadata.author !== undefined) updates.author = metadata.author;
  if (metadata.country !== undefined) updates.country = metadata.country;
  if (metadata.countryCode !== undefined) updates.countryCode = metadata.countryCode;
  if (metadata.state !== undefined) updates.state = metadata.state;

  const tags = getExifToolWriteTags(updates);

  if (Object.keys(tags).length === 0) {
    return json({ message: "Nebyla detekována žádná změna metadat", results });
  }

  const manifestPath = path.resolve(process.cwd(), `src/data/${contentDir}/images.manifest.json`);
  if (!fs.existsSync(manifestPath)) {
    throw error(500, `Manifest nebyl nalezen na ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  for (const id of imageIds) {
    try {
      const imageEntry = findImageById(manifest as Manifest, id);
      if (!imageEntry) {
        throw new Error(`ID obrázku ${id} nebylo nalezeno v manifestu.`);
      }

      let filePath = path.join(contentRoot, imageEntry.src);
      if (!fs.existsSync(filePath)) {
        const candidate = path.join(contentRoot, "pics", imageEntry.src);
        if (fs.existsSync(candidate)) {
          filePath = candidate;
        }
      }

      await exiftool.write(filePath, tags, {
        writeArgs: ["-overwrite_original", "-m", "-charset", "iptc=UTF8"],
      });

      results.success.push(id);
    } catch (err) {
      results.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    await regenerateManifest(contentDir);
  } catch (_err) {}

  return json({
    message: "Zpracování dávky dokončeno",
    stats: {
      total: imageIds.length,
      success: results.success.length,
      failed: results.failed.length,
    },
    results,
  });
}

function regenerateManifest(contentDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("bun", ["scripts/generate-images.ts", "--manifestOnly"], {
      env: { ...process.env, CONTENT_DIR: contentDir },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn manifest regeneration: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Manifest regeneration exited with code ${code}: ${stderr}`));
      }
    });
  });
}

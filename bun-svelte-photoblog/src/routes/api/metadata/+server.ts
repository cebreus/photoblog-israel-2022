import { json, error } from "@sveltejs/kit";
import { exiftool } from "exiftool-vendored";
import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import { dev } from "$app/environment";
import type { Manifest, ImageEntry } from "$lib/types/manifest";

function findImageById(
  manifestData: Manifest,
  id: string,
): ImageEntry | undefined {
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

  // Map metadata fields to ExifTool tags
  // We prioritize IPTC and XMP for broad compatibility
  const tags: Record<string, string | string[]> = {};

  if (metadata.title) {
    tags["IPTC:ObjectName"] = metadata.title;
    tags["XMP:Title"] = metadata.title;
  }
  if (metadata.caption) {
    tags["IPTC:Caption-Abstract"] = metadata.caption;
    tags["XMP:Description"] = metadata.caption;
  }
  if (metadata.city) {
    tags["IPTC:City"] = metadata.city;
    tags["XMP:City"] = metadata.city;
  }
  if (metadata.keywords && Array.isArray(metadata.keywords)) {
    tags["IPTC:Keywords"] = metadata.keywords;
    tags["XMP:Subject"] = metadata.keywords;
  }

  // If no valid tags to write, exit early but successfully (nothing to do)
  if (Object.keys(tags).length === 0) {
    return json({ message: "Nebyla detekována žádná změna metadat", results });
  }

  // Read manifest dynamically
  const manifestPath = path.resolve(
    process.cwd(),
    `src/lib/data/${contentDir}/images.manifest.json`,
  );
  if (!fs.existsSync(manifestPath)) {
    throw error(500, `Manifest nebyl nalezen na ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  // We process sequentially to avoid overwhelming system resources if many images are selected
  // and to provide granular error reporting.
  for (const id of imageIds) {
    try {
      const imageEntry = findImageById(manifest as Manifest, id);
      if (!imageEntry) {
        throw new Error(`ID obrázku ${id} nebylo nalezeno v manifestu.`);
      }

      // ... inside the loop
      let filePath = path.join(contentRoot, imageEntry.src);
      // The source images are stored in the configured subdirectory.
      if (!fs.existsSync(filePath)) {
        const candidate = path.join(contentRoot, "pics", imageEntry.src);
        if (fs.existsSync(candidate)) {
          filePath = candidate;
        }
      }

      // Verify file exists is handled by exiftool generally, but good to check
      // We rely on exiftool-vendored's promise rejection for file issues.

      await exiftool.write(filePath, tags, {
        writeArgs: ["-overwrite_original", "-coding=utf8", "-m"], // -m for ignore minor errors
      });

      results.success.push(id);
    } catch (err) {
      console.error(`Error updating metadata for ${id}:`, err);
      results.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // We should probably end the exiftool process if we were a script,
  // but in a long-running server, keeping the singleton alive is fine/intended.

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

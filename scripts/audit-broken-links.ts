#!/usr/bin/env bun

import fsp from "node:fs/promises";
import path from "node:path";
import { intro, note, outro, spinner } from "@clack/prompts";
import pc from "picocolors";
import type { ImageEntry } from "../src/lib/types/manifest";
import { resolveGalleryDirectory } from "./lib/gallery-resolver";
import { createLogger } from "./lib/logger";
import { loadImagesManifest, loadPeopleManifest } from "./lib/manifest-repository";

const logger = createLogger("audit-broken-links");

async function main() {
  intro(pc.cyan("🔗 Checking for Broken Links in Manifests"));

  const contentDir = await resolveGalleryDirectory();
  const staticDir = path.resolve(process.cwd(), `static/${contentDir}`);
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);

  const s = spinner();
  s.start("Loading manifests...");
  const peopleManifest = await loadPeopleManifest(dataDir);
  const imagesManifest = await loadImagesManifest(dataDir);
  s.stop("Manifests loaded");

  const brokenThumbnails: string[] = [];
  const brokenCrops: { personId: string; imageId: string; path: string }[] = [];

  if (peopleManifest) {
    s.start("Checking people thumbnails...");
    for (const person of peopleManifest.people) {
      if (person.thumbnail) {
        const fullPath = path.join(staticDir, person.thumbnail);
        try {
          await fsp.access(fullPath);
        } catch {
          brokenThumbnails.push(`${person.id}: ${person.thumbnail}`);
        }
      }
    }
    s.stop(`Checked people. Found ${pc.red(brokenThumbnails.length)} broken thumbnails.`);
  }

  if (imagesManifest && peopleManifest) {
    s.start("Checking face crops for all images...");
    for (const day of imagesManifest.photoDays) {
      for (const item of day.items) {
        if (item.type === "image") {
          const img = item as ImageEntry;
          if (img.people) {
            for (const pid of img.people) {
              const cropPath = path.join("faces", pid, `${img.id}.jpg`);
              const fullPath = path.join(staticDir, cropPath);
              try {
                await fsp.access(fullPath);
              } catch {
                brokenCrops.push({ personId: pid, imageId: img.id, path: cropPath });
              }
            }
          }
        }
      }
    }
    s.stop(`Checked image crops. Found ${pc.red(brokenCrops.length)} missing crops.`);
  }

  if (brokenThumbnails.length > 0 || brokenCrops.length > 0) {
    note(
      `Broken Thumbnails:\n${brokenThumbnails.slice(0, 10).join("\n")}${brokenThumbnails.length > 10 ? "\n..." : ""}\n\n` +
        `Missing Crops:\n${brokenCrops
          .slice(0, 10)
          .map((c) => `${c.personId} @ ${c.imageId}`)
          .join("\n")}${brokenCrops.length > 10 ? "\n..." : ""}`,
      "Broken Links Report",
    );
  } else {
    outro(pc.green("✨ No broken links found!"));
  }
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});

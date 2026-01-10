#!/usr/bin/env bun
/**
 * @fileoverview Detect broken links and missing assets referenced by manifests.
 *
 * @description
 * Scans manifests and static assets to list broken references (thumbnails, crops, files).
 */

import { createLogger } from "$scripts/core/cli-logger";
import { resolveGalleryDirectory } from "$scripts/gallery/resolver";
import { loadImagesManifest, loadPeopleManifest } from "$scripts/manifests/repository";
import { runWithPerformance } from "$scripts/utils/performance";
import { fileExists } from "$scripts/utils/runtime";
import { intro, note, outro, spinner } from "@clack/prompts";
import path from "node:path";
import pc from "picocolors";
import { isImageEntry } from "../src/lib/types/manifest";

const logger = createLogger("audit-broken-links");

async function main() {
  intro(pc.cyan("🔗 Checking for Broken Links in Manifests"));

  const contentDir = await resolveGalleryDirectory();
  const staticDir = path.resolve(process.cwd(), `static-${contentDir}`);
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
          await fileExists(fullPath);
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
        if (isImageEntry(item)) {
          if (item.people) {
            for (const pid of item.people) {
              const cropPath = path.join("faces", pid, `${item.id}.jpg`);
              const fullPath = path.join(staticDir, cropPath);
              try {
                await fileExists(fullPath);
              } catch {
                brokenCrops.push({ personId: pid, imageId: item.id, path: cropPath });
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

runWithPerformance("audit-broken-links", main).catch((err: any) => {
  logger.error({ err }, "Fatal Error");
  process.exit(1);
});

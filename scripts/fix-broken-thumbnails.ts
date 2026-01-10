#!/usr/bin/env bun
/**
 * @fileoverview Repair broken people thumbnails in the gallery.
 *
 * @description
 * Scans people thumbnails and attempts to repair or regenerate invalid or missing thumbnails.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { resolveGalleryDirectory } from "$scripts/gallery/resolver";
import {
  loadImagesManifest,
  loadPeopleManifest,
  savePeopleManifest,
} from "$scripts/manifests/repository";
import { runWithPerformance } from "$scripts/utils/performance";
import { fileExists } from "$scripts/utils/runtime";
import { intro, note, outro, spinner } from "@clack/prompts";
import path from "node:path";
import pc from "picocolors";
import { isImageEntry } from "../src/lib/types/manifest";

const logger = createLogger("fix-broken-thumbnails");

async function main() {
  intro(pc.cyan("🛠️ Repairing Broken People Thumbnails"));

  const contentDir = await resolveGalleryDirectory();
  const staticDir = path.resolve(process.cwd(), `static-${contentDir}`);
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);

  const s = spinner();
  s.start("Loading manifests...");
  const peopleManifest = await loadPeopleManifest(dataDir);
  const imagesManifest = await loadImagesManifest(dataDir);
  s.stop("Manifests loaded");

  if (!peopleManifest || !imagesManifest) {
    logger.error({}, "Required manifests not found.");
    process.exit(1);
  }

  // Map people to their images from images manifest
  const personToImages = new Map<string, string[]>();
  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (isImageEntry(item)) {
        if (item.people) {
          for (const pid of item.people) {
            if (!personToImages.has(pid)) personToImages.set(pid, []);
            personToImages.get(pid)?.push(item.id);
          }
        }
      }
    }
  }

  const repaired: string[] = [];
  const unfixable: string[] = [];

  s.start("Auditing and repairing thumbnails...");
  for (const person of peopleManifest.people) {
    let isValid = false;
    if (person.thumbnail) {
      const fullPath = path.join(staticDir, person.thumbnail);
      try {
        await fileExists(fullPath);
        isValid = true;
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      logger.debug(
        { personName: person.name, personId: person.id },
        "Thumbnail missing, attempting repair",
      );
      const imageIds = personToImages.get(person.id) || [];
      let foundNew = false;

      for (const imageId of imageIds) {
        const cropPath = `faces/${person.id}/${imageId}.jpg`;
        const fullPath = path.join(staticDir, cropPath);
        try {
          await fileExists(fullPath);
          person.thumbnail = cropPath;
          foundNew = true;
          repaired.push(`${person.name} (${person.id}) -> ${cropPath}`);
          break;
        } catch {}
      }

      if (!foundNew) {
        unfixable.push(`${person.name} (${person.id})`);
      }
    }
  }
  s.stop(`Done. Repaired ${pc.green(repaired.length)} thumbnails.`);

  if (repaired.length > 0) {
    s.start("Saving changes...");
    await savePeopleManifest(dataDir, peopleManifest);
    s.stop("Changes saved to people.manifest.json");

    note(
      repaired.slice(0, 10).join("\n") + (repaired.length > 10 ? "\n..." : ""),
      "Repaired Thumbnails",
    );
  }

  if (unfixable.length > 0) {
    note(
      unfixable.slice(0, 10).join("\n") + (unfixable.length > 10 ? "\n..." : ""),
      "Still Broken (No valid crops found)",
    );
  }

  outro(pc.green("✨ Repair process complete!"));
}

runWithPerformance("fix-broken-thumbnails", main).catch((err: any) => {
  logger.error({ err }, "Repair process failed");
  process.exit(1);
});

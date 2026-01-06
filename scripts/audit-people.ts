/**
 * Audit script for people.manifest.json
 * Checks for inconsistencies and optionally fixes them.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createLogger } from "./lib/core/cli-logger";
import { recalculateAllFaceCounts, removeEmptyPeople } from "./lib/faces/people";
import {
  loadClusteringConstraints,
  loadImagesManifest,
  loadPeopleManifest,
  saveClusteringConstraints,
  savePeopleManifest,
} from "./lib/manifests/repository";

const logger = createLogger("audit-people");

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    fix: { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
    contentDir: { type: "string", default: process.env.CONTENT_DIR || "egypt-2025" },
  },
  strict: true,
});

async function main() {
  const contentDir = values.contentDir as string;
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const facesDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);

  logger.info({ contentDir }, "Auditing people data for gallery");

  const peopleManifest = await loadPeopleManifest(dataDir);
  const imagesManifest = await loadImagesManifest(dataDir);

  if (!peopleManifest || !imagesManifest) {
    logger.error({}, "Failed to load manifests");
    process.exit(1);
  }

  let issues = 0;
  let fixed = 0;

  // 1. Check faceCount consistency
  logger.info({}, "Checking faceCount consistency");
  const originalCounts = new Map<string, number>();
  for (const person of peopleManifest.people) {
    originalCounts.set(person.id, person.faceCount);
  }

  recalculateAllFaceCounts(peopleManifest, imagesManifest);

  for (const person of peopleManifest.people) {
    const original = originalCounts.get(person.id) ?? 0;
    if (original !== person.faceCount) {
      issues++;
      logger.warn(
        {
          personName: person.name,
          personId: person.id,
          manifestCount: original,
          actualCount: person.faceCount,
        },
        "faceCount mismatch",
      );
      if (values.fix) {
        fixed++;
        logger.info({ personId: person.id }, "Fixed faceCount");
      } else {
        // Restore original if not fixing
        person.faceCount = original;
      }
    }
  }

  // 2. Check for empty people
  logger.info({}, "Checking for empty people (faceCount === 0)");
  const emptyPeople = peopleManifest.people.filter((p) => p.faceCount === 0);
  for (const person of emptyPeople) {
    issues++;
    logger.warn({ personName: person.name, personId: person.id }, "Empty person found");
  }

  if (values.fix && emptyPeople.length > 0) {
    const removed = removeEmptyPeople(peopleManifest);
    fixed += removed;
    logger.info({ removedCount: removed }, "Removed empty people");
  }

  // 3. Check for orphaned face crops
  logger.info({}, "Checking for orphaned face crops");
  const expectedPersonIds = new Set(peopleManifest.people.map((p) => p.id));

  try {
    const personDirs = await fsp.readdir(facesDir);
    for (const dir of personDirs) {
      if (!expectedPersonIds.has(dir)) {
        issues++;
        logger.warn({ directory: dir }, "Orphaned face directory");
        // We don't auto-delete orphaned directories for safety
      }
    }
  } catch (_e) {
    logger.info({}, "No faces directory found");
  }

  // 4. Check constraints for stale references
  logger.info({}, "Checking constraints for stale references");

  try {
    const constraints = await loadClusteringConstraints(dataDir);
    if (!constraints) {
      logger.info({}, "No constraints file found");
    } else {
      const allImages = imagesManifest.photoDays.flatMap((day) =>
        day.items.filter((item) => item.type !== "separator"),
      );
      const imageIds = new Set(allImages.map((img) => img.id));
      const staleDisconnects: any[] = [];
      const staleConnects: any[] = [];

      for (const c of constraints.disconnects) {
        if (!expectedPersonIds.has(c.personId) || !imageIds.has(c.imageId)) {
          issues++;
          staleDisconnects.push(c);
          logger.warn({ personId: c.personId, imageId: c.imageId }, "Stale disconnect");
        }
      }

      for (const c of constraints.connects) {
        if (!expectedPersonIds.has(c.personId) || !imageIds.has(c.imageId)) {
          issues++;
          staleConnects.push(c);
          logger.warn({ personId: c.personId, imageId: c.imageId }, "Stale connect");
        }
      }

      if (values.fix && (staleDisconnects.length > 0 || staleConnects.length > 0)) {
        constraints.disconnects = constraints.disconnects.filter(
          (c) =>
            !staleDisconnects.some((s) => s.personId === c.personId && s.imageId === c.imageId),
        );
        constraints.connects = constraints.connects.filter(
          (c) => !staleConnects.some((s) => s.personId === c.personId && s.imageId === c.imageId),
        );
        await saveClusteringConstraints(dataDir, constraints);
        fixed += staleDisconnects.length + staleConnects.length;
        logger.info({}, "Updated constraints file");
      }
    }
  } catch (_e) {
    logger.info({}, "No constraints file found");
  }

  // Save fixes if any
  if (values.fix && fixed > 0) {
    await savePeopleManifest(dataDir, peopleManifest);
    logger.info({ fixedCount: fixed }, "Saved fixes to people manifest");
  }

  // Summary
  logger.info({}, "---");
  logger.info({ issuesFound: issues, fixedCount: fixed }, "Audit complete");

  if (issues > 0 && !values.fix) {
    logger.info({ issuesFound: issues }, "Run with --fix to automatically repair issues");
  }

  process.exit(issues > 0 && !values.fix ? 1 : 0);
}

main().catch((e) => {
  logger.error({ err: e }, "Audit failed");
  process.exit(1);
});

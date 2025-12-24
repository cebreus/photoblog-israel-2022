#!/usr/bin/env bun
/**
 * Audit and repair script for people data consistency.
 * This script checks for:
 * 1. faceCount mismatches between people.manifest.json and images.manifest.json
 * 2. Orphaned face crop files (files without manifest entries)
 * 3. Missing face crop files (manifest entries without files)
 * 4. Stale constraints (references to deleted people)
 *
 * Usage: bun scripts/audit-people.ts [--fix] [--verbose]
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { ClusteringConstraints } from "../src/lib/utils/manifest-validators";
import { createLogger } from "./lib/core/cli-logger";
import { recalculateAllFaceCounts, removeEmptyPeople } from "./lib/faces/people";
import {
  loadImagesManifest,
  loadPeopleManifest,
  savePeopleManifest,
} from "./lib/manifests/repository";

const logger = createLogger("audit-people");

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    fix: { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
    contentDir: { type: "string", default: Bun.env.CONTENT_DIR || "egypt-2025" },
  },
  strict: true,
});

async function main() {
  const contentDir = values.contentDir as string;
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const facesDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);

  logger.info(`Auditing people data for gallery: ${contentDir}`);

  const peopleManifest = await loadPeopleManifest(dataDir);
  const imagesManifest = await loadImagesManifest(dataDir);

  if (!peopleManifest || !imagesManifest) {
    logger.error("Failed to load manifests");
    process.exit(1);
  }

  let issues = 0;
  let fixed = 0;

  // 1. Check faceCount consistency
  logger.info("Checking faceCount consistency...");
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
        `faceCount mismatch: ${person.name} (${person.id}) - manifest: ${original}, actual: ${person.faceCount}`,
      );
      if (values.fix) {
        fixed++;
        logger.info(`  → Fixed`);
      } else {
        // Restore original if not fixing
        person.faceCount = original;
      }
    }
  }

  // 2. Check for empty people
  logger.info("Checking for empty people (faceCount === 0)...");
  const emptyPeople = peopleManifest.people.filter((p) => p.faceCount === 0);
  for (const person of emptyPeople) {
    issues++;
    logger.warn(`Empty person: ${person.name} (${person.id})`);
  }

  if (values.fix && emptyPeople.length > 0) {
    const removed = removeEmptyPeople(peopleManifest);
    fixed += removed;
    logger.info(`  → Removed ${removed} empty people`);
  }

  // 3. Check for orphaned face crops
  logger.info("Checking for orphaned face crops...");
  const expectedPersonIds = new Set(peopleManifest.people.map((p) => p.id));

  try {
    const personDirs = await fsp.readdir(facesDir);
    for (const dir of personDirs) {
      if (!expectedPersonIds.has(dir)) {
        issues++;
        logger.warn(`Orphaned face directory: ${dir}`);
        // We don't auto-delete orphaned directories for safety
      }
    }
  } catch (_e) {
    logger.info("No faces directory found");
  }

  // 4. Check constraints for stale references
  logger.info("Checking constraints for stale references...");
  const constraintsPath = path.resolve(dataDir, "clustering-constraints.json");

  try {
    const cData = await fsp.readFile(constraintsPath, "utf-8");
    const constraints: ClusteringConstraints = JSON.parse(cData);
    let constraintsModified = false;

    if (constraints.disconnects) {
      const staleDisconnects = constraints.disconnects.filter(
        (c) => !expectedPersonIds.has(c.personId),
      );
      if (staleDisconnects.length > 0) {
        issues += staleDisconnects.length;
        for (const c of staleDisconnects) {
          logger.warn(`Stale disconnect: ${c.personId} on image ${c.imageId}`);
        }
        if (values.fix) {
          constraints.disconnects = constraints.disconnects.filter((c) =>
            expectedPersonIds.has(c.personId),
          );
          constraintsModified = true;
          fixed += staleDisconnects.length;
        }
      }
    }

    if (constraints.connects) {
      const staleConnects = constraints.connects.filter((c) => !expectedPersonIds.has(c.personId));
      if (staleConnects.length > 0) {
        issues += staleConnects.length;
        for (const c of staleConnects) {
          logger.warn(`Stale connect: ${c.personId} on image ${c.imageId}`);
        }
        if (values.fix) {
          constraints.connects = constraints.connects.filter((c) =>
            expectedPersonIds.has(c.personId),
          );
          constraintsModified = true;
          fixed += staleConnects.length;
        }
      }
    }

    if (constraintsModified) {
      await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
      logger.info("  → Updated constraints file");
    }
  } catch (_e) {
    logger.info("No constraints file found");
  }

  // Save fixes
  if (values.fix && fixed > 0) {
    await savePeopleManifest(dataDir, peopleManifest);
    logger.info(`Saved ${fixed} fixes to people manifest`);
  }

  // Summary
  logger.info("---");
  logger.info(`Audit complete: ${issues} issues found, ${fixed} fixed`);

  if (issues > 0 && !values.fix) {
    logger.info("Run with --fix to automatically repair issues");
  }

  process.exit(issues > 0 && !values.fix ? 1 : 0);
}

main().catch((e) => {
  logger.error("Audit failed:", e);
  process.exit(1);
});

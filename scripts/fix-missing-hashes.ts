/**
 * @fileoverview Fix people with missing hashes in IDs by recovering from Backup based on createdAt.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { parseCliArguments } from "$scripts/core/cli-parser";
import { withManifestLock } from "$scripts/manifests/lock";
import {
  batchRenamePeople,
  loadManifestsForNormalization,
  type RenameOperation,
} from "$scripts/people/normalization";
import { readdir } from "$scripts/utils/runtime";
import type { PeopleManifest } from "$shared/types/manifest";
import { confirm, intro, outro, spinner } from "@clack/prompts";
import path from "node:path";

const logger = createLogger("fix-missing-hashes");
const options = parseCliArguments(process.argv.slice(2));

async function getLatestBackup(gallery: string): Promise<string | null> {
  const backupRoot = path.resolve(".temp/backup");
  try {
    const entries = await readdir(backupRoot, { withFileTypes: true });
    const galleryBackups = (entries as import("node:fs").Dirent[])
      .filter((e: any) => e.isDirectory() && e.name.startsWith(gallery))
      .map((e: any) => e.name)
      .sort()
      .reverse();

    if (galleryBackups.length === 0) return null;
    return path.join(backupRoot, galleryBackups[0], "people.manifest.json");
  } catch {
    return null;
  }
}

async function main() {
  intro("🔧 Fix Missing Hashes (Backup Recovery)");

  const gallery = options.gallery || "egypt-2025";
  const dataDir = path.resolve(`src/data/${gallery}`);
  const staticDir = path.resolve(`static-${gallery}`);
  const facesDir = path.resolve(staticDir, "faces");

  // 1. Load backup
  const backupPath = await getLatestBackup(gallery);
  if (!backupPath) {
    logger.error({}, "No backup found!");
    process.exit(1);
  }
  logger.info({ backupPath }, "Using backup for recovery");

  let backupManifest: PeopleManifest;
  try {
    const content = await Bun.file(backupPath).text();
    backupManifest = JSON.parse(content);
  } catch (err) {
    logger.error({ err }, "Failed to load backup");
    process.exit(1);
  }

  await withManifestLock(dataDir, async () => {
    const manifests = await loadManifestsForNormalization(dataDir);
    if (!manifests) {
      logger.error({}, "Failed to load manifests");
      process.exit(1);
    }

    // 2. Find targets in current manifest
    const targets = manifests.people.people.filter((p) => {
      // Ends with dash or looks like a counter without hash
      // e.g. statue-009- or statue-009 (if dash was stripped previously?)
      // Currently we saw statue-009-
      return p.id.endsWith("-") || !/-[a-f0-9]{8}(-|$)/.test(p.id);
    });

    if (targets.length === 0) {
      outro("No people with missing IDs found.");
      return;
    }

    logger.info({ count: targets.length }, "Found broken IDs");

    // 3. Match with backup and plan fixes
    const operations: RenameOperation[] = [];
    const counters: Record<string, number> = { person: 0, statue: 0, painting: 0 };

    // Init counters
    const ID_REGEX = /^(person|statue|painting)-(\d+)-/;
    for (const p of manifests.people.people) {
      const match = p.id.match(ID_REGEX);
      if (match) {
        const [_, prefix, numStr] = match;
        const num = parseInt(numStr, 10);
        if (!Number.isNaN(num) && num > counters[prefix]) {
          counters[prefix] = num;
        }
      }
    }

    for (const person of targets) {
      // Find in backup by createdAt (closest match or exact)
      // Backup might have slightly different data if things moved, but createdAt should be stable.
      const backupPerson = backupManifest.people.find((bp) => bp.createdAt === person.createdAt);

      if (!backupPerson) {
        logger.warn({ id: person.id, createdAt: person.createdAt }, "No backup match found!");
        continue;
      }

      // Extract hash from Backup Person
      // Backup person might be "person-29266176-" (broken ID)
      // BUT its Name might be "Person 29266176" (Good Name!)

      let hash = "";

      // Try ID first (if valid)
      const idMatch = backupPerson.id.match(/-([a-f0-9]{8})(-|$)/);
      if (idMatch) {
        hash = idMatch[1];
      } else {
        // Try Name
        const nameMatch = backupPerson.name.match(/Person (\d+)/i);
        if (nameMatch) {
          hash = nameMatch[1];
        } else {
          // Try from Backup ID itself if it is just "person-<HASH>-"
          const rawIdMatch = backupPerson.id.match(/person-(\d+)-?/);
          if (rawIdMatch && rawIdMatch[1].length === 8) {
            hash = rawIdMatch[1];
          }
        }
      }

      if (!hash) {
        logger.warn(
          { id: person.id, backupId: backupPerson.id, backupName: backupPerson.name },
          "Could not recover hash from backup.",
        );
        continue;
      }

      const category = person.category || "person";
      const prefix = category;

      counters[prefix]++;
      const num = String(counters[prefix]).padStart(3, "0");
      const newId = `${prefix}-${num}-${hash}`;
      const newName = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${num}`;

      operations.push({
        person,
        oldId: person.id,
        newId,
        newName,
      });

      logger.info(
        { oldId: person.id, backupId: backupPerson.id, newId, recoveredHash: hash },
        "Planned recovery",
      );
    }

    if (operations.length === 0) {
      outro("No operations possible.");
      return;
    }

    const shouldContinue = await confirm({
      message: `Ready to recover ${operations.length} people. Continue?`,
    });

    if (!shouldContinue) {
      outro("Cancelled.");
      process.exit(0);
    }

    const s = spinner();
    try {
      const processed = await batchRenamePeople({
        manifests,
        operations,
        gallery,
        dataDir,
        facesDir,
        spinner: s,
      });
      outro(`✅ Recovered ${processed} people.`);
    } catch (err) {
      logger.error({ err }, "Error");
      process.exit(1);
    }
  });
}

main().catch((err) => {
  logger.error({ err }, "Unhandled error");
  process.exit(1);
});

/**
 * @fileoverview Restore original hashes to person IDs in manifests.
 *
 * @description
 * Uses backup manifests to recover original person ID hashes and apply canonical naming.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { parseCliArguments } from "$scripts/core/cli-parser";
import { withManifestLock } from "$scripts/manifests/lock";
import {
  batchRenamePeople,
  extractHash,
  loadManifestsForNormalization,
  type RenameOperation,
} from "$scripts/people/normalization";
import type { PeopleManifest } from "$shared/types/manifest";
import { confirm, intro, outro, spinner } from "@clack/prompts";
import path from "node:path";

const logger = createLogger("fix-person-format");
const options = parseCliArguments(process.argv.slice(2));

// Backup path from previous normalization run
const BACKUP_PATH = ".temp/backup/egypt-2025-1767862539891/people.manifest.json";

async function main() {
  intro("🔧 Fix Person Format (Add Hashes)");

  const gallery = options.gallery || "egypt-2025";
  const dataDir = path.resolve(`src/data/${gallery}`);
  const staticDir = path.resolve(`static-${gallery}`);
  const facesDir = path.resolve(staticDir, "faces");

  // 1. Load backup to get original hashes
  logger.info({}, "Loading backup manifest for hash recovery...");
  const backupContent = await Bun.file(BACKUP_PATH).text();
  const backupManifest: PeopleManifest = JSON.parse(backupContent);

  // Find "Odpojeno od" entries in backup (in order)
  const disconnectedEntries = backupManifest.people.filter((p) =>
    p.name.startsWith("Odpojeno od "),
  );

  logger.info({ count: disconnectedEntries.length }, "Found original disconnected entries");

  await withManifestLock(dataDir, async () => {
    // 2. Load current manifests
    const manifests = await loadManifestsForNormalization(dataDir);
    if (!manifests) {
      logger.error({}, "Failed to load manifests");
      process.exit(1);
    }

    // 3. Build rename operations
    const operations: RenameOperation[] = [];

    for (let i = 0; i < disconnectedEntries.length; i++) {
      const entry = disconnectedEntries[i];
      const hash = extractHash(entry.id);
      const num = String(i + 1).padStart(3, "0");
      const currentId = `person-${i + 1}`;

      const person = manifests.people.people.find((p) => p.id === currentId);
      if (!person) {
        logger.warn({ currentId }, "Person not found in current manifest");
        continue;
      }

      operations.push({
        person,
        oldId: currentId,
        newId: `person-${num}-${hash}`,
        newName: `Person ${num}`,
      });

      logger.info({ from: currentId, to: `person-${num}-${hash}` }, "Planned rename");
    }

    // 4. Confirm
    const shouldContinue = await confirm({
      message: `Ready to fix ${operations.length} person-* IDs. Continue?`,
    });

    if (!shouldContinue) {
      outro("Cancelled.");
      process.exit(0);
    }

    // 5. Execute
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

      outro(`✅ Fixed ${processed} person-* entries with hash format.`);
    } catch (err) {
      logger.error({ err }, "Critical error");
      process.exit(1);
    }
  });
}

main().catch((err: any) => {
  logger.error({ err }, "Unhandled error");
  process.exit(1);
});

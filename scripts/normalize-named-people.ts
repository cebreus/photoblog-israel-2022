/**
 * @fileoverview Normalize named people with readable slugs while preserving hashes.
 *
 * @description
 * Converts hashed person IDs (person-<hash>) to a readable slug pattern and updates manifests.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { parseCliArguments } from "$scripts/core/cli-parser";
import { withManifestLock } from "$scripts/manifests/lock";
import {
  batchRenamePeople,
  extractHash,
  isGenericName,
  loadManifestsForNormalization,
  type RenameOperation,
} from "$scripts/people/normalization";
import { fileExists } from "$scripts/utils/runtime";
import type { Person } from "$shared/types/manifest";
import { toSlug } from "$shared/utils/strings";
import { confirm, intro, outro, spinner } from "@clack/prompts";
import path from "node:path";

const logger = createLogger("normalize-named");
const options = parseCliArguments(process.argv.slice(2));

function isValidTarget(p: Person): boolean {
  // Must have hash ID pattern
  if (!/^person-[a-f0-9]+/.test(p.id)) return false;

  // Skip generic patterns
  if (isGenericName(p.name)) return false;

  // Validate slug will be valid (min 2 chars)
  const slug = toSlug(p.name);
  if (slug.length < 2) return false;

  // Skip if slug would conflict with protected patterns
  if (/^(person|statue|painting)(-|$)/i.test(slug)) return false;

  return true;
}

async function main() {
  intro("🏷️ Normalize Named People");

  const gallery = options.gallery || "egypt-2025";
  const dataDir = path.resolve(`src/data/${gallery}`);
  const staticDir = path.resolve(`static-${gallery}`);
  const facesDir = path.resolve(staticDir, "faces");

  logger.info({ gallery }, "Starting named people normalization");

  await withManifestLock(dataDir, async () => {
    const manifests = await loadManifestsForNormalization(dataDir);
    if (!manifests) {
      logger.error({}, "Failed to load manifests");
      process.exit(1);
    }

    // Find valid targets
    const targets = manifests.people.people.filter(isValidTarget);

    if (targets.length === 0) {
      outro("No named people with hash IDs found.");
      return;
    }

    // Sort by createdAt for deterministic order (oldest first)
    targets.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

    logger.info({ count: targets.length }, "Found named people to normalize");

    // Build operations with collision detection
    const operations: RenameOperation[] = [];
    const usedSlugs = new Set<string>();

    for (const person of targets) {
      const hash = extractHash(person.id);
      const baseSlug = toSlug(person.name);
      let counter = 1;

      while (true) {
        const slug = counter === 1 ? baseSlug : `${baseSlug}-${counter}`;
        const candidateId = `${slug}-${hash}`;

        const existsInManifest = manifests.people.people.some(
          (p) => p.id === candidateId && p !== person,
        );
        const existsOnDisk = await fileExists(path.join(facesDir, candidateId));

        if (!existsInManifest && !existsOnDisk && !usedSlugs.has(candidateId)) {
          usedSlugs.add(candidateId);
          operations.push({
            person,
            oldId: person.id,
            newId: candidateId,
            // Keep original name
          });
          logger.info({ name: person.name, oldId: person.id, newId: candidateId }, "Target");
          break;
        }
        counter++;
      }
    }

    const shouldContinue = await confirm({
      message: `Ready to normalize ${operations.length} named people. Continue?`,
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

      outro(`✅ Normalized ${processed} named people.`);
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

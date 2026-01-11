/**
 * @fileoverview Compact generic person IDs (person-XXX) to remove gaps and start from 001.
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
import type { Person } from "$shared/types/manifest";
import { confirm, intro, outro, spinner } from "@clack/prompts";
import path from "node:path";

const logger = createLogger("compact-ids");
const options = parseCliArguments(process.argv.slice(2));

async function main() {
  intro("Compacting Generic IDs");

  const gallery = options.gallery || "egypt-2025";
  const dataDir = path.resolve(`src/data/${gallery}`);
  const staticDir = path.resolve(`static-${gallery}`);
  const facesDir = path.resolve(staticDir, "faces");

  await withManifestLock(dataDir, async () => {
    const manifests = await loadManifestsForNormalization(dataDir);
    if (!manifests) {
      logger.error({}, "Failed to load manifests");
      process.exit(1);
    }

    // 1. Group generics by category
    const categoryGroups: Record<string, Person[]> = {
      person: [],
      statue: [],
      painting: [],
    };

    const ID_REGEX = /^(person|statue|painting)-(\d+)-/;

    for (const p of manifests.people.people) {
      // Only target generics that follow the standard number pattern
      // Skip those that are named or don't match pattern (should represent majority after previous cleanups)
      if (!isGenericName(p.name)) continue;

      const match = p.id.match(ID_REGEX);
      if (match) {
        const [_, prefix] = match;
        if (categoryGroups[prefix]) {
          categoryGroups[prefix].push(p);
        }
      }
    }

    const operations: RenameOperation[] = [];

    // 2. Process each group
    for (const [category, people] of Object.entries(categoryGroups)) {
      if (people.length === 0) continue;

      // Sort by current number (extracted from ID) to preserve order
      people.sort((a, b) => {
        const numA = parseInt(a.id.match(ID_REGEX)?.[2] || "0", 10);
        const numB = parseInt(b.id.match(ID_REGEX)?.[2] || "0", 10);
        return numA - numB;
      });

      logger.info({ category, count: people.length }, "Processing category");

      // Re-index from 1
      let counter = 1;
      for (const person of people) {
        const hash = extractHash(person.id);
        const numStr = String(counter).padStart(3, "0");
        const newId = `${category}-${numStr}-${hash}`;

        // Only rename if needed
        if (newId !== person.id) {
          // Also update Name to match new number
          // Name format: "Person 001" or "Statue 001"
          // Capitalize category first char
          const capitalizedCat = category.charAt(0).toUpperCase() + category.slice(1);
          const newName = `${capitalizedCat} ${numStr}`;

          operations.push({
            person,
            oldId: person.id,
            newId,
            newName,
          });

          logger.info({ oldId: person.id, newId }, "Planned re-index");
        }
        counter++;
      }
    }

    if (operations.length === 0) {
      outro("No gaps found. All IDs are already compact.");
      return;
    }

    // 3. Confirm
    const shouldContinue = await confirm({
      message: `Ready to compact IDs for ${operations.length} people. Continue?`,
    });

    if (!shouldContinue) {
      outro("Cancelled.");
      process.exit(0);
    }

    // 4. Execute
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
      outro(`✅ Compacted ${processed} IDs.`);
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

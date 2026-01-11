/**
 * @fileoverview Normalize IDs for generic people (Person X, Statue Y) to standard format.
 * Fixes anomalies like `person-29266189-29266184`.
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
import { confirm, intro, outro, spinner } from "@clack/prompts";
import path from "node:path";

const logger = createLogger("normalize-generics");
const options = parseCliArguments(process.argv.slice(2));

async function main() {
  intro("🔧 Normalize Generics");

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

    // 1. Find generic people with non-standard IDs
    // Standard format: <type>-<3+ digits>-<hash>
    // We want to catch things like `person-29266189-29266184` (too long number in middle, or just looks weird)
    // Actually, simply: if Name is Generic, ID MUST be `type-number-hash`.
    // If it looks like `type-slug-hash` (where slug != number), it's wrong?
    // In `person-29266189-29266184`, the middle part IS a number. But it matches the Name number?
    // Our standard usually uses sequential counters (001, 002...).
    // Let's enforce that if ID middle part > 999 and matches Name, we might want to re-serialize to a proper counter.
    // OR simpler: just find all Generics and if their ID doesn't look like `type-\d{3}-\w{8}`, rename them.

    const targets = manifests.people.people.filter((p) => {
      if (!isGenericName(p.name)) return false;

      // Check if ID matches standard pattern strictly
      // Standard: (person|statue|painting)-(\d{3})-(\w{8})
      // NOTE: Regex should allow more than 3 digits if we have >999 people? Yes.
      // But `29266189` is clearly not a counter, it's a timestamp/ID.

      const standardMatch = p.id.match(/^(person|statue|painting)-(\d{3,})-([a-f0-9]{8})$/);

      if (!standardMatch) return true; // Wrong format completely

      // If it matches, check if the middle number is "reasonable" (e.g. < 10000).
      // If it is 29266189, it's definitely an anomaly we want to fix.
      const num = parseInt(standardMatch[2], 10);
      if (num > 10000) return true;

      return false;
    });

    if (targets.length === 0) {
      outro("No generic people with anomalous IDs found.");
      return;
    }

    logger.info({ count: targets.length }, "Found anomalous generics");

    // 2. Prepare operations
    // Calculate max counters
    const counters: Record<string, number> = { person: 0, statue: 0, painting: 0 };
    const ID_REGEX = /^(person|statue|painting)-(\d+)-/;

    for (const p of manifests.people.people) {
      // Only count "Standard" IDs towards the max counter
      // Skip the anomalous ones we are about to rename!
      if (targets.includes(p)) continue;

      const match = p.id.match(ID_REGEX);
      if (match) {
        const [_, prefix, numStr] = match;
        const num = parseInt(numStr, 10);
        // Only consider reasonable counters as "max"
        if (!Number.isNaN(num) && num < 10000 && num > counters[prefix]) {
          counters[prefix] = num;
        }
      }
    }

    const operations: RenameOperation[] = [];

    for (const person of targets) {
      const category = person.category || "person";
      const prefix = category;
      const hash = extractHash(person.id); // Valid hash exists here

      counters[prefix]++;
      const num = String(counters[prefix]).padStart(3, "0");
      const newId = `${prefix}-${num}-${hash}`;
      // Update Name too? "Person 29266189" -> "Person 066"
      const newName = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${num}`;

      operations.push({
        person,
        oldId: person.id,
        newId,
        newName,
      });

      logger.info({ oldId: person.id, name: person.name, newId, newName }, "Planned normalization");
    }

    const shouldContinue = await confirm({
      message: `Ready to normalize ${operations.length} generics. Continue?`,
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
      outro(`✅ Normalized ${processed} generics.`);
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

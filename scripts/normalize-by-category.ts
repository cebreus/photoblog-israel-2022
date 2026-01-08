/**
 * Normalize all people by category.
 * Format: <category>-<name>-<hash> or <category>-NNN-<hash>
 *
 * Categories:
 * - person → person-
 * - statue → statue-
 * - painting → painting-
 */

import path from "node:path";
import { confirm, intro, outro, spinner } from "@clack/prompts";
import { toSlug } from "../shared/utils/strings";
import { createLogger } from "./lib/core/cli-logger";
import { parseCliArguments } from "./lib/core/cli-parser";
import { withManifestLock } from "./lib/manifests/lock";
import {
  batchRenamePeople,
  extractHash,
  isGenericName,
  loadManifestsForNormalization,
  type RenameOperation,
} from "./lib/people/normalization";
import { fileExists } from "./lib/utils/runtime";

const logger = createLogger("normalize-category");
const options = parseCliArguments(process.argv.slice(2));

const CATEGORY_PREFIX: Record<string, string> = {
  person: "person",
  statue: "statue",
  painting: "painting",
};

function hasCorrectPrefix(id: string, category: string): boolean {
  const prefix = CATEGORY_PREFIX[category] || "person";

  // Strict check: if it contains the old Czech prefix in the middle, it's invalid
  // e.g. person-osoba-001 or statue-socha-001
  if (id.includes("-osoba-") || id.includes("-socha-")) return false;

  return id.startsWith(`${prefix}-`);
}

async function main() {
  intro("🏷️ Normalize by Category");

  const gallery = options.gallery || "egypt-2025";
  const dataDir = path.resolve(`src/data/${gallery}`);
  const staticDir = path.resolve(`static-${gallery}`);
  const facesDir = path.resolve(staticDir, "faces");

  logger.info({ gallery }, "Starting category normalization");

  await withManifestLock(dataDir, async () => {
    const manifests = await loadManifestsForNormalization(dataDir);
    if (!manifests) {
      logger.error({}, "Failed to load manifests");
      process.exit(1);
    }

    // Find people with wrong category prefix
    const targets = manifests.people.people.filter((p) => {
      const category = p.category || "person";
      return !hasCorrectPrefix(p.id, category);
    });

    if (targets.length === 0) {
      outro("All people have correct category prefixes.");
      return;
    }

    // Calculate counters for generic names per category
    const counters: Record<string, number> = { person: 0, statue: 0, painting: 0 };

    // Find existing max numbers
    for (const p of manifests.people.people) {
      for (const [_cat, prefix] of Object.entries(CATEGORY_PREFIX)) {
        const match = p.id.match(new RegExp(`^${prefix}-(\\d+)-`));
        if (match) {
          const num = Number.parseInt(match[1], 10);
          if (num > counters[prefix]) counters[prefix] = num;
        }
      }
    }

    logger.info({ count: targets.length }, "Found people to normalize");

    // Plan renames
    const operations: RenameOperation[] = [];
    const usedIds = new Set<string>();

    for (const person of targets) {
      const hash = extractHash(person.id);
      const category = person.category || "person";
      const prefix = CATEGORY_PREFIX[category] || "person";

      let newId: string;
      let newName: string | undefined;

      if (!isGenericName(person.name)) {
        // Named: statue-sphinx-hash
        const slug = toSlug(person.name);
        newId = `${prefix}-${slug}-${hash}`;
        // Keep original name
      } else {
        // Generic: statue-001-hash
        counters[prefix]++;
        const num = String(counters[prefix]).padStart(3, "0");
        newId = `${prefix}-${num}-${hash}`;
        newName = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${num}`;
      }

      // Check collision
      while (
        usedIds.has(newId) ||
        manifests.people.people.some((p) => p.id === newId && p !== person) ||
        (await fileExists(path.join(facesDir, newId)))
      ) {
        counters[prefix]++;
        const num = String(counters[prefix]).padStart(3, "0");
        newId = `${prefix}-${num}-${hash}`;
        newName = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} ${num}`;
      }

      usedIds.add(newId);
      operations.push({ person, oldId: person.id, newId, newName });
      logger.info({ name: person.name, category, oldId: person.id, newId }, "Planned");
    }

    const shouldContinue = await confirm({
      message: `Ready to normalize ${operations.length} people by category. Continue?`,
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

      outro(`✅ Normalized ${processed} people by category.`);
    } catch (err) {
      logger.error({ err }, "Critical error");
      process.exit(1);
    }
  });
}

main().catch((err) => {
  logger.error({ err }, "Unhandled error");
  process.exit(1);
});

import fsp from "node:fs/promises";
import path from "node:path";
import { confirm, intro, outro, spinner } from "@clack/prompts";
import { createLogger } from "./lib/core/cli-logger";
import { parseCliArguments } from "./lib/core/cli-parser";
import {
  batchRenamePeople,
  extractHash,
  loadManifestsForNormalization,
  type RenameOperation,
} from "./lib/people/normalization";
import { fileExists } from "./lib/utils/runtime";

const logger = createLogger("normalize-names");
const options = parseCliArguments(process.argv.slice(2));

async function main() {
  intro("🧹 Normalize Person Names");

  const gallery = options.gallery || "egypt-2025";
  const dataDir = path.resolve(`src/data/${gallery}`);
  const staticDir = path.resolve(`static-${gallery}`);
  const facesDir = path.resolve(staticDir, "faces");

  logger.info({ gallery }, "Starting normalization");

  // Load manifests
  const manifests = await loadManifestsForNormalization(dataDir);
  if (!manifests) {
    logger.error({}, "Failed to load manifests");
    process.exit(1);
  }

  // 1. Find targets: "Odpojeno od" entries
  const targets = manifests.people.people.filter((p) => p.name.startsWith("Odpojeno od "));
  if (targets.length === 0) {
    outro("No 'Odpojeno od' people found.");
    return;
  }

  logger.info({ count: targets.length }, "Found targets to normalize");

  // 2. Find next available sequence number
  let maxIndex = 0;
  const numberPattern = /^person-(\d+)-/i;

  for (const p of manifests.people.people) {
    const match = p.id.match(numberPattern);
    if (match) {
      const idx = Number.parseInt(match[1], 10);
      if (idx > maxIndex) maxIndex = idx;
    }
  }

  // Also check filesystem
  try {
    const entries = await fsp.readdir(facesDir);
    for (const entry of entries) {
      const match = entry.match(numberPattern);
      if (match) {
        const idx = Number.parseInt(match[1], 10);
        if (idx > maxIndex) maxIndex = idx;
      }
    }
  } catch {
    // Directory might not exist
  }

  let nextIndex = maxIndex + 1;
  logger.info({ startSequence: nextIndex }, "Starting sequence assignment");

  // 3. Build rename operations
  const operations: RenameOperation[] = [];

  for (const person of targets) {
    // Find next available ID (check for collisions)
    while (true) {
      const num = String(nextIndex).padStart(3, "0");
      const candidateId = `person-${num}-${extractHash(person.id)}`;

      const idExists = manifests.people.people.some((p) => p.id === candidateId);
      const folderExists = await fileExists(path.join(facesDir, candidateId));

      if (!idExists && !folderExists) {
        operations.push({
          person,
          oldId: person.id,
          newId: candidateId,
          newName: `Person ${num}`,
        });
        break;
      }
      nextIndex++;
    }

    nextIndex++;
  }

  // 4. Confirm
  const shouldContinue = await confirm({
    message: `Ready to normalize ${operations.length} people. Continue?`,
  });

  if (!shouldContinue) {
    outro("Cancelled.");
    process.exit(0);
  }

  // 5. Execute batch rename
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

    outro(`✅ Normalized ${processed} people.`);
  } catch (err) {
    logger.error({ err }, "Critical error during normalization");
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error({ err }, "Unhandled error");
  process.exit(1);
});

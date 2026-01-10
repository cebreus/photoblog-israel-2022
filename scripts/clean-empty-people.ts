#!/usr/bin/env bun
/**
 * Clean Empty People Script 🧹
 *
 * Removes people with faceCount: 0 from the manifest.
 * These are usually leftovers from "invalidate detection" or "unmatch" operations
 * where the last face was removed.
 */

import path from "node:path";
import { createLogger } from "$scripts/core/cli-logger";
import { fileExists, readFileText, writeFile } from "$scripts/utils/runtime";

const logger = createLogger("clean-empty-people");
const contentDir = process.env.CONTENT_DIR || "egypt-2025";
const DATA_DIR = path.resolve(process.cwd(), "src/data", contentDir);

async function run() {
  try {
    const peoplePath = path.join(DATA_DIR, "people.manifest.json");
    logger.info({ contentDir }, "🧹 Cleaning empty profiles");

    if (!(await fileExists(peoplePath))) {
      logger.error({ peoplePath }, "Manifest not found!");
      return;
    }

    const raw = await readFileText(peoplePath);
    const data = JSON.parse(raw);
    const people = data.people || [];

    const initialCount = people.length;
    // Filter out people with 0 faces
    const cleanPeople = people.filter((p: any) => p.faceCount > 0);
    const removedCount = initialCount - cleanPeople.length;

    if (removedCount > 0) {
      data.people = cleanPeople;
      await writeFile(peoplePath, JSON.stringify(data, null, 2));
      logger.info({ removedCount }, "✅ Removed empty profiles");
    } else {
      logger.info({}, "✨ No empty profiles found.");
    }
  } catch (e: any) {
    logger.error({ err: e }, "Cleanup failed");
    process.exit(1);
  }
}

run();

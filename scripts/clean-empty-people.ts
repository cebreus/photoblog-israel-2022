#!/usr/bin/env bun
/**
 * @fileoverview Remove people with zero faces from the people manifest.
 *
 * @description
 * Cleans up leftover person entries (faceCount: 0) caused by detection invalidation or unmatching.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { fileExists, readFileText, writeFile } from "$scripts/utils/runtime";
import path from "node:path";

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

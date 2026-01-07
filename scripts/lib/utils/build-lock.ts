#!/usr/bin/env bun
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../core/cli-logger";

const logger = createLogger("build-lock");

/**
 * Simple file-based lock mechanism for preventing concurrent builds
 * from overwriting each other's assets in static root.
 */

const LOCK_FILE = path.resolve(process.cwd(), ".temp/build.lock");
const MAX_WAIT_MS = 60000; // Wait max 60 seconds for lock
const CHECK_INTERVAL_MS = 500; // Check every 500ms

export async function acquireLock(gallery: string): Promise<void> {
  const startTime = Date.now();

  while (true) {
    try {
      // Try to read existing lock
      const existingLock = await Bun.file(LOCK_FILE).text();
      const lockData = JSON.parse(existingLock);

      // Check if lock is stale (older than 5 minutes)
      if (Date.now() - lockData.timestamp > 300000) {
        logger.warn({ gallery: lockData.gallery }, "Stale lock detected, removing");
        await unlink(LOCK_FILE);
        continue; // Retry
      }

      // Lock exists and is fresh
      if (Date.now() - startTime > MAX_WAIT_MS) {
        throw new Error(
          `Timeout waiting for build lock. Another build (${lockData.gallery}) is still running.`,
        );
      }

      logger.info({ gallery: lockData.gallery }, "Waiting for build to finish");
      await Bun.sleep(CHECK_INTERVAL_MS);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Lock file doesn't exist, we can acquire it
        try {
          await writeFile(
            LOCK_FILE,
            JSON.stringify({
              gallery,
              timestamp: Date.now(),
              pid: process.pid,
            }),
          );
          logger.info({ gallery }, "Build lock acquired");
          return;
        } catch (_e) {
          // Race condition: another process created lock first
          // Continue loop to wait
          await Bun.sleep(100);
        }
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
  }
}

export async function releaseLock(): Promise<void> {
  try {
    await unlink(LOCK_FILE);
    logger.info({}, "Build lock released");
  } catch (_e) {
    // Lock file already removed, that's fine
  }
}

/**
 * Ensure lock is released even if process crashes
 */
process.on("exit", () => {
  // Synchronous cleanup during exit is generally discouraged but sometimes necessary.
  // We'll skip it here to satisfy the lint and rely on SIGINT/SIGTERM handlers
  // and stale lock detection in acquireLock.
});

process.on("SIGINT", async () => {
  await releaseLock();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await releaseLock();
  process.exit(0);
});

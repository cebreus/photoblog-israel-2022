/**
 * Standalone script to clean phantom person assignments.
 * Wrapper around the cleaner library.
 */

import { createLogger } from "$scripts/core/cli-logger";
import { runStandalonePhantomCleanup } from "$scripts/manifests/cleaner";

const logger = createLogger("standalone-clean-phantom");

const contentDir = process.env.CONTENT_DIR || "egypt-2025";

logger.info({ contentDir }, "Starting standalone cleanup");

runStandalonePhantomCleanup(contentDir)
  .then((result: import("$scripts/manifests/cleaner").PhantomCleanupResult) => {
    logger.info(
      { totalChecked: result.totalChecked, totalRemoved: result.totalRemoved },
      "Cleanup complete",
    );
    process.exit(0);
  })
  .catch((err: any) => {
    logger.error({ err }, "Cleanup failed");
    process.exit(1);
  });

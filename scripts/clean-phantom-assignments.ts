/**
 * Standalone script to clean phantom person assignments.
 * Wrapper around the cleaner library.
 */

import { createLogger } from "./lib/core/cli-logger";
import { cleanPhantomAssignments } from "./lib/manifests/cleaner";

const logger = createLogger("standalone-clean-phantom");

const contentDir = process.env.CONTENT_DIR || "egypt-2025";

logger.info({ contentDir }, "Starting standalone cleanup");

cleanPhantomAssignments(contentDir)
  .then((result) => {
    logger.info(
      { totalChecked: result.totalChecked, totalRemoved: result.totalRemoved },
      "Cleanup complete",
    );
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, "Cleanup failed");
    process.exit(1);
  });

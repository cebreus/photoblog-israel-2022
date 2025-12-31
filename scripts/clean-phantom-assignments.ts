/**
 * Standalone script to clean phantom person assignments.
 * Wrapper around the cleaner library.
 */

import { createLogger } from "$scripts/lib/core/cli-logger";
import { cleanPhantomAssignments } from "./lib/manifests/cleaner";

const logger = createLogger("standalone-clean-phantom");

const contentDir = Bun.env.CONTENT_DIR || "egypt-2025";

logger.info(`Starting standalone cleanup for: ${contentDir}`);

cleanPhantomAssignments(contentDir)
  .then((result) => {
    logger.info(`Done! Checked: ${result.totalChecked}, Removed: ${result.totalRemoved}`);
    process.exit(0);
  })
  .catch((err) => {
    logger.error("Failed:", err);
    process.exit(1);
  });

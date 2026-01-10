import { createLogger } from "../core/cli-logger";

const logger = createLogger("resources");

/**
 * Formats bytes into a human-readable string (MB).
 */
function toMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Logs the current memory usage of the process.
 * Useful for tracking potential memory leaks during intensive operations.
 */
export function logResourceUsage(label = "snapshot") {
  const mem = process.memoryUsage();

  logger.debug(
    {
      label,
      rss: toMB(mem.rss),
      heapTotal: toMB(mem.heapTotal),
      heapUsed: toMB(mem.heapUsed),
      external: toMB(mem.external),
      // Raw values for programmatic analysis if needed
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
    },
    `Memory: ${toMB(mem.heapUsed)} used / ${toMB(mem.rss)} RSS`,
  );
}

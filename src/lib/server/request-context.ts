import type { Logger } from "$lib/logger";
import { AsyncLocalStorage } from "node:async_hooks";

// Store the entire logger instance, which already has the child bindings (requestId, etc.)
const requestStorage = new AsyncLocalStorage<Logger>();

/**
 * Runs a callback within the context of a specific logger.
 * Any code called synchronously or asynchronously (via promises) within the callback
 * will have access to this logger via getCurrentLogger().
 */
export function runWithLogger<T>(logger: Logger, callback: () => T): T {
  return requestStorage.run(logger, callback);
}

/**
 * Retrieves the logger for the current request context, if available.
 * Returns undefined if called outside of a request context (e.g., in a background task initiated without context).
 */
export function getCurrentLogger(): Logger | undefined {
  return requestStorage.getStore();
}

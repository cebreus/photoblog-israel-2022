import { AsyncLocalStorage } from "node:async_hooks";
import { createLogger } from "../core/cli-logger";

let _logger: ReturnType<typeof createLogger> | null = null;
function getLogger() {
  if (!_logger) {
    _logger = createLogger("resources");
  }
  return _logger;
}

export type PerformanceEntry = {
  name: string;
  duration: number;
};

export type PerformanceRecorder = {
  add: (name: string, duration: number) => void;
  getBreakdown: () => Record<string, number>;
};

export function createPerformanceRecorder(): PerformanceRecorder {
  const entries: PerformanceEntry[] = [];

  return {
    add(name: string, duration: number) {
      entries.push({ name, duration });
    },
    getBreakdown() {
      const breakdown: Record<string, number> = {};
      for (const entry of entries) {
        breakdown[entry.name] = (breakdown[entry.name] || 0) + entry.duration;
      }
      return breakdown;
    },
  };
}

const performanceStorage = new AsyncLocalStorage<PerformanceRecorder>();

export function runWithPerformance<T>(nameOrCallback: string | (() => T), callback?: () => T): T {
  const actualCallback = typeof nameOrCallback === "string" ? callback : nameOrCallback;
  if (!actualCallback) {
    throw new Error("Callback required when using name");
  }
  return performanceStorage.run(createPerformanceRecorder(), actualCallback);
}

export function getPerformanceRecorder(): PerformanceRecorder | undefined {
  return performanceStorage.getStore();
}

/**
 * Wraps an asynchronous operation with performance measurement.
 * Safe to use even if no recorder is active.
 */
export async function measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const recorder = performanceStorage.getStore();
  if (!recorder) return fn();

  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    recorder.add(name, duration);
  }
}

/**
 * Wraps a synchronous operation with performance measurement.
 * Safe to use even if no recorder is active.
 */
export function measureSync<T>(name: string, fn: () => T): T {
  const recorder = performanceStorage.getStore();
  if (!recorder) return fn();

  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    recorder.add(name, duration);
  }
}

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

  getLogger().debug(
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

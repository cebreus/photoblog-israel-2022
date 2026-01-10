/**
 * Performance measurement utility
 *
 * Usage:
 * perfLogger.time('operation-name');
 * // ... do work ...
 * perfLogger.timeEnd('operation-name');
 */

interface PerfEntry {
  name: string;
  duration: number;
  timestamp: number;
}

interface PerfStats {
  name: string;
  count: number;
  total: number;
  avg: number;
  min: number;
  max: number;
}

function createPerfLogger() {
  let entries: PerfEntry[] = [];
  const maxEntries = 100;

  function time(label: string): void {
    if (typeof performance === "undefined") return;
    performance.mark(`${label}-start`);
  }

  function timeEnd(label: string): number {
    if (typeof performance === "undefined") return 0;

    try {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);

      const measures = performance.getEntriesByName(label, "measure");
      const measure = measures[measures.length - 1];

      if (!measure) return 0;

      const duration = measure.duration;

      // Store entry
      entries.push({
        name: label,
        duration,
        timestamp: Date.now(),
      });

      // Keep only recent entries
      if (entries.length > maxEntries) {
        entries.shift();
      }

      // Clean up marks
      performance.clearMarks(`${label}-start`);
      performance.clearMarks(`${label}-end`);
      performance.clearMeasures(label);

      return duration;
    } catch {
      return 0;
    }
  }

  /**
   * Get performance report for a specific label or all labels
   */
  function getReport(labelFilter?: string): PerfStats[] {
    function matchesFilter(entry: PerfEntry): boolean {
      return !labelFilter || entry.name.includes(labelFilter);
    }

    const filtered = labelFilter ? entries.filter(matchesFilter) : entries;

    function reduceStats(
      acc: Record<string, PerfStats>,
      entry: PerfEntry,
    ): Record<string, PerfStats> {
      if (!acc[entry.name]) {
        acc[entry.name] = {
          name: entry.name,
          count: 0,
          total: 0,
          avg: 0,
          min: Infinity,
          max: 0,
        };
      }

      const stats = acc[entry.name];
      stats.count++;
      stats.total += entry.duration;
      stats.min = Math.min(stats.min, entry.duration);
      stats.max = Math.max(stats.max, entry.duration);
      stats.avg = stats.total / stats.count;

      return acc;
    }

    const grouped = filtered.reduce(reduceStats, {} as Record<string, PerfStats>);

    function sortByTotal(a: PerfStats, b: PerfStats): number {
      return b.total - a.total;
    }

    return Object.values(grouped).sort(sortByTotal);
  }

  /**
   * Clear all stored entries
   */
  function clear(): void {
    entries = [];
    if (typeof performance !== "undefined") {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  return {
    time,
    timeEnd,
    getReport,
    clear,
  };
}

export const perfLogger = createPerfLogger();

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as unknown as { perfLogger: typeof perfLogger }).perfLogger = perfLogger;
}

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

class PerfLogger {
  private entries: PerfEntry[] = [];
  private maxEntries = 100;

  time(label: string) {
    if (typeof performance === "undefined") return;
    performance.mark(`${label}-start`);
  }

  timeEnd(label: string): number {
    if (typeof performance === "undefined") return 0;

    try {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);

      const measures = performance.getEntriesByName(label, "measure");
      const measure = measures[measures.length - 1];

      if (!measure) return 0;

      const duration = measure.duration;

      // Store entry
      this.entries.push({
        name: label,
        duration,
        timestamp: Date.now(),
      });

      // Keep only recent entries
      if (this.entries.length > this.maxEntries) {
        this.entries.shift();
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
  getReport(labelFilter?: string) {
    const filtered = labelFilter
      ? this.entries.filter((e) => e.name.includes(labelFilter))
      : this.entries;

    const grouped = filtered.reduce(
      (acc, entry) => {
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
      },
      {} as Record<
        string,
        { name: string; count: number; total: number; avg: number; min: number; max: number }
      >,
    );

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }

  /**
   * Clear all stored entries
   */
  clear() {
    this.entries = [];
    if (typeof performance !== "undefined") {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }
}

export const perfLogger = new PerfLogger();

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as unknown as { perfLogger: PerfLogger }).perfLogger = perfLogger;
}

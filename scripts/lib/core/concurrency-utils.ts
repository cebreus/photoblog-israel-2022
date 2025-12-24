/**
 * Resolves the concurrency level based on the provided value or system defaults.
 * Uses navigator.hardwareConcurrency to avoid Node.js 'os' module dependency.
 *
 * @param concurrency - The logical concurrency level (number, 'auto', or undefined)
 * @returns The resolved numeric concurrency level
 */
export function getConcurrency(concurrency: number | string | undefined): number {
  if (concurrency === "auto") {
    // navigator.hardwareConcurrency is available in Bun
    const cpus = navigator.hardwareConcurrency || 2;
    return Math.max(1, cpus - 1);
  }

  if (typeof concurrency === "number" && concurrency > 0) {
    return concurrency;
  }

  if (typeof concurrency === "string") {
    const parsed = parseInt(concurrency, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Default behavior if undefined or invalid
  const cpus = navigator.hardwareConcurrency || 2;
  return Math.max(1, cpus - 1);
}

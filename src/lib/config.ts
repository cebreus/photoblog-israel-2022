/**
 * Application configuration constants.
 * Centralized defaults to avoid hardcoding across the codebase.
 */

/** Default gallery/content directory when CONTENT_DIR env is not set */
export const DEFAULT_CONTENT_DIR = "egypt-2025";

/**
 * Get the active content directory from environment or fallback.
 */
export function getContentDir(): string {
  // Use import.meta.env for Vite dev server, process.env for Bun production
  const envVar =
    typeof import.meta !== "undefined" && import.meta.env?.CONTENT_DIR
      ? import.meta.env.CONTENT_DIR
      : typeof process !== "undefined" && process.env?.CONTENT_DIR
        ? process.env.CONTENT_DIR
        : undefined;

  return envVar || DEFAULT_CONTENT_DIR;
}

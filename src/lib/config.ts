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
  return Bun.env.CONTENT_DIR || DEFAULT_CONTENT_DIR;
}

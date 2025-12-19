import path from "path";
import { toSlug } from "../../src/lib/utils/strings";

/**
 * Validates and canonicalizes a given path, ensuring it stays within a specified safe root directory.
 * Prevents path traversal vulnerabilities.
 * @param unsafePath The path string to validate.
 * @param safeRoot The absolute path to the root directory that `unsafePath` must be contained within.
 * @returns The resolved, canonical absolute path if it is safe.
 * @throws An error if the path attempts to traverse outside the safe root.
 */
export function validatePathInsideRoot(unsafePath: string, safeRoot: string): string {
  const resolvedPath = path.resolve(safeRoot, unsafePath);

  // Ensure the resolved path starts with the safeRoot followed by a path separator,
  // or is the safeRoot itself (if unsafePath was just "").
  // This handles cases like "/safe/root/../evil" resolving to "/safe/evil".
  if (!resolvedPath.startsWith(safeRoot + path.sep) && resolvedPath !== safeRoot) {
    throw new Error(
      `Path traversal attempt detected: "${unsafePath}" resolves outside of the safe directory "${safeRoot}".`,
    );
  }
  return resolvedPath;
}

/**
 * Sanitizes a filename to remove any path separators or potentially dangerous characters,
 * ensuring it can only refer to a file within a single directory.
 * @param filename The filename string to sanitize.
 * @returns A sanitized filename.
 */
export function toSafeFilename(filename: string): string {
  // Remove any directory separators
  const safe = filename.replace(/[/\\]/g, "");
  // Remove common unsafe characters (e.g., those used in shell commands or regex)
  return toSlug(safe); // Assuming toSlug handles other unsafe chars well
}

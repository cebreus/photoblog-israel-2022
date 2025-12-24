import slugify from "slugify";

/**
 * Convert a string to a URL-friendly slug.
 * Used by both build scripts (manifest generation) and application (dynamic routing).
 */
export function toSlug(name: string): string {
    return slugify(name || "", { lower: true, strict: true });
}

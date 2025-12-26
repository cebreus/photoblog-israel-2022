import slugify from "slugify";

/**
 * Convert a string to a URL-friendly slug.
 * Used by both build scripts (manifest generation) and application (dynamic routing).
 *
 * Special handling: Preserves double-hyphen (--) before the last segment if present.
 * This is used for special suffixes like --collage, --zoom2x3, --panorama, etc.
 */
export function toSlug(name: string): string {
    if (!name) return "";

    // Check if name has double-hyphen suffix pattern (--something at the end)
    const doubleHyphenMatch = name.match(/--([^-]+)$/);

    const slug = slugify(name, { lower: true, strict: true });

    // If original had double-hyphen suffix, restore it
    if (doubleHyphenMatch) {
        const suffix = doubleHyphenMatch[1].toLowerCase();
        // Remove single hyphen version if slugify collapsed it
        const withoutSuffix = slug.replace(new RegExp(`-${suffix}$`), "");
        return `${withoutSuffix}--${suffix}`;
    }

    return slug;
}

import slugify from "slugify";

export function pluralizeCzech(
  count: number,
  forms: [string, string, string],
): string {
  if (count === 1) return forms[0];
  if (count >= 2 && count <= 4) return forms[1];
  return forms[2];
}

/**
 * Convenience helper to output a localized count plus the correct pluralized
 * noun form, e.g. `pluralizeCount(3, ['den','dny','dní'])` -> "3 dny".
 */
export function pluralizeCount(
  count: number,
  forms: [string, string, string],
): string {
  return `${count} ${pluralizeCzech(count, forms)}`;
}

/**
 * Convert a display author name into a URL-safe slug. We keep this simple and
 * deterministic so it can be used in query params and mapping.
 */
export function toSlug(name: string): string {
  return slugify(name || "", { lower: true, strict: true });
}

// --- From date-utils.ts ---
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  // Use Intl.DateTimeFormat for a more native and locale-aware solution
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatWeekdayCzech(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("cs-CZ", { weekday: "long" }).format(date);
}

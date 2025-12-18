import slugify from "slugify";

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

/**
 * Formats a range of dates according to Czech typographic rules.
 * - 2 days: "21. a 22. listopadu 2025"
 * - >2 days: "21.—23. listopadu 2025"
 * Handles cross-month/year cases gracefully.
 */
export function formatDateRange(dates: string[]): string {
  if (!dates || dates.length === 0) return "";
  if (dates.length === 1) return formatDateForDisplay(dates[0]);

  // Sort dates to ensure correct range
  const sorted = [...dates].sort();
  const first = new Date(sorted[0]);
  const last = new Date(sorted[sorted.length - 1]);

  const sameMonth = first.getMonth() === last.getMonth();
  const sameYear = first.getFullYear() === last.getFullYear();

  const formatMonthYear = new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  });

  const d1 = first.getDate();
  const dLast = last.getDate();

  if (dates.length === 2) {
    if (sameMonth && sameYear) {
      // "21. listopadu 2025" -> parts: ["21.", "listopadu", "2025"]
      const fullOne = formatDateForDisplay(sorted[0]);
      const parts = fullOne.split(" ");
      parts.shift(); // remove "21."
      const suffix = parts.join(" "); // "listopadu 2025"
      return `${d1}. a ${dLast}. ${suffix}`;
    }
    return `${formatDateForDisplay(sorted[0])} a ${formatDateForDisplay(sorted[1])}`;
  }

  // More than 2 days
  if (sameMonth && sameYear) {
    // Use the full formatted date of the last day (e.g. "23. listopadu 2025")
    // to preserve the genitive case of the month.
    // We construct "21.—23. listopadu 2025".
    const fullLastDate = formatDateForDisplay(sorted[sorted.length - 1]);
    return `${d1}.—${fullLastDate}`;
  }

  // Cross-month or cross-year > 2 days
  return `${formatDateForDisplay(sorted[0])} — ${formatDateForDisplay(sorted[sorted.length - 1])}`;
}

import slugify from "slugify";

export function toSlug(name: string): string {
  return slugify(name || "", { lower: true, strict: true });
}

export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
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

function sortDatesChronologically(dates: string[]): string[] {
  return [...dates].sort();
}

export function formatDateRange(dates: string[]): string {
  if (!dates || dates.length === 0) return "";
  if (dates.length === 1) return formatDateForDisplay(dates[0]);

  const sorted = sortDatesChronologically(dates);
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
      const fullOne = formatDateForDisplay(sorted[0]);
      const parts = fullOne.split(" ");
      parts.shift();
      const suffix = parts.join(" ");
      return `${d1}. a ${dLast}. ${suffix}`;
    }
    return `${formatDateForDisplay(sorted[0])} a ${formatDateForDisplay(sorted[1])}`;
  }

  // More than 2 days
  if (sameMonth && sameYear) {
    const fullLastDate = formatDateForDisplay(sorted[sorted.length - 1]);
    return `${d1}.—${fullLastDate}`;
  }

  return `${formatDateForDisplay(sorted[0])} — ${formatDateForDisplay(sorted[sorted.length - 1])}`;
}

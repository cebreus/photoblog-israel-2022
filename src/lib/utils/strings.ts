import { languageTag } from "$lib/i18n";
import slugify from "slugify";

export function toSlug(name: string): string {
  return slugify(name || "", { lower: true, strict: true });
}

export function formatDateForDisplay(dateString: string): string {
  const lang = languageTag() === "cs" ? "cs-CZ" : "en-US";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatWeekday(dateString: string): string {
  const lang = languageTag() === "cs" ? "cs-CZ" : "en-US";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(lang, { weekday: "long" }).format(date);
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
  const _lang = languageTag() === "cs" ? "cs-CZ" : "en-US";
  const d1 = first.getDate();
  const dLast = last.getDate();

  if (dates.length === 2) {
    if (sameMonth && sameYear) {
      if (languageTag() === "cs") {
        const fullOne = formatDateForDisplay(sorted[0]);
        const parts = fullOne.split(" ");
        parts.shift();
        const suffix = parts.join(" ");
        return `${d1}. a ${dLast}. ${suffix}`;
      } else {
        const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(first);
        const year = first.getFullYear();
        return `${month} ${d1} and ${dLast}, ${year}`;
      }
    }
    const separator = languageTag() === "cs" ? " a " : " and ";
    return `${formatDateForDisplay(sorted[0])}${separator}${formatDateForDisplay(sorted[1])}`;
  }

  // More than 2 days
  if (sameMonth && sameYear) {
    if (languageTag() === "cs") {
      const fullLastDate = formatDateForDisplay(sorted[sorted.length - 1]);
      return `${d1}.—${fullLastDate}`;
    } else {
      const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(first);
      const year = first.getFullYear();
      return `${month} ${d1}—${dLast}, ${year}`;
    }
  }

  const rangeSeparator = languageTag() === "cs" ? " — " : " — ";
  return `${formatDateForDisplay(sorted[0])}${rangeSeparator}${formatDateForDisplay(sorted[sorted.length - 1])}`;
}

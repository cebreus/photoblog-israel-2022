/**
 * Formats an ISO-like string to a user-friendly wall clock representation.
 * Ignores any timezone offsets and purely formats the date/time components.
 * 
 * Input: "2025-11-25T09:27:36.058+02:00" or "2025-11-25T08:27:36"
 * Output: "25. 11. 2025 08:27" (or matching locale)
 */
export function formatWallClock(isoStr: string | undefined): string {
    if (!isoStr) return "";

    // Extract base components via regex to avoid Date object timezone shifts
    const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return isoStr;

    const [, y, m, d, hh, mm] = match;
    // Using Czech format as per user's UI
    return `${parseInt(d)}. ${parseInt(m)}. ${y} ${hh}:${mm}`;
}

/**
 * Normalizes any date input to a "Pure Wall Clock" ISO string (YYYY-MM-DDTHH:mm:ss).
 * Strips offsets and ensures no "Z" suffix.
 */
export function toPureWallClockISO(val: string | Date | undefined): string | undefined {
    if (!val) return undefined;

    if (val instanceof Date) {
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}T${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
    }

    // If it's a string, strip any trailing offsets or 'Z'
    // First, convert EXIF YYYY:MM:DD to ISO YYYY-MM-DD if needed
    let sanitized = val.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");

    // Match up to seconds, discard the rest (offsets, milliseconds)
    const match = sanitized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    if (match) return match[0];

    // Fallback for dates without time
    const dateOnly = sanitized.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateOnly) return `${dateOnly[0]}T00:00:00`;

    return sanitized;
}

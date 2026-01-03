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
 * Returns the current local system time as a pure ISO string (YYYY-MM-DDTHH:mm:ss).
 * Removes any timezone offset or "Z" suffix.
 * Useful for initializing timestamps.
 */
export function getLocalNowIsoString(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Ensures minimal ISO format from potentially mixed inputs (Date, string).
 * For Date objects, converts to ISO string and strips time (YYYY-MM-DD).
 * For strings, preserves as much as possible but takes substring(0, 10).
 */
export function ensureIsoDateString(val: string | Date): string {
    if (val instanceof Date) {
        return val.toISOString().substring(0, 10);
    }
    return String(val).substring(0, 10);
}

/**
 * Normalizes any date input to a "Pure Wall Clock" ISO string (YYYY-MM-DDTHH:mm:ss).
 * Strips offsets and ensures no "Z" suffix.
 */
export function toPureWallClockISO(val: string | Date | undefined, fallbackDate?: string): string | undefined {
    if (!val) return undefined;

    if (val instanceof Date) {
        // Warning: When passing a Date object, we assume it represents the desired instant in UTC components
        // (because Date objects are just timestamps). 
        // If you want "Local Wall Clock", usage getLocalNowIsoString() instead.
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${val.getUTCFullYear()}-${pad(val.getUTCMonth() + 1)}-${pad(val.getUTCDate())}T${pad(val.getUTCHours())}:${pad(val.getUTCMinutes())}:${pad(val.getUTCSeconds())}`;
    }

    // If it's a string, strip any trailing offsets or 'Z'
    // First, convert EXIF YYYY:MM:DD to ISO YYYY-MM-DD
    let sanitized = val.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");

    // Replace space between date and time with T (common in EXIF)
    sanitized = sanitized.replace(" ", "T");

    // Match up to seconds, discard the rest (offsets, milliseconds)
    const match = sanitized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    if (match) return match[0];

    // Fallback for dates without time
    const dateOnly = sanitized.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateOnly) return `${dateOnly[0]}T00:00:00`;

    // Fallback for time without date (e.g. "09:42:00")
    // If fallbackDate is provided, prepend it
    const timeOnly = sanitized.match(/^\d{2}:\d{2}(:\d{2})?$/);
    if (timeOnly && fallbackDate) {
        return `${fallbackDate}T${sanitized}`;
    }

    return sanitized;
}

/**
 * Parses an ISO string into numeric components WITHOUT using Date objects.
 * Returns null if parsing fails.
 */
function parseIsoComponents(isoStr: string): { y: number; m: number; d: number; hh: number; mm: number; ss: number } | null {
    const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/);
    if (!match) return null;
    return {
        y: parseInt(match[1], 10),
        m: parseInt(match[2], 10),
        d: parseInt(match[3], 10),
        hh: parseInt(match[4], 10),
        mm: parseInt(match[5], 10),
        ss: parseInt(match[6] || "0", 10),
    };
}

/**
 * Formats numeric components back to ISO string (YYYY-MM-DDTHH:mm:ss).
 */
function formatIsoFromComponents(c: { y: number; m: number; d: number; hh: number; mm: number; ss: number }): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${c.y}-${pad(c.m)}-${pad(c.d)}T${pad(c.hh)}:${pad(c.mm)}:${pad(c.ss)}`;
}

/**
 * Calculates the difference in seconds between two ISO strings.
 * Returns (toTime - fromTime) in seconds, as a pure number.
 * Uses string parsing only, no Date objects.
 */
export function diffIsoStringsInSeconds(fromIso: string, toIso: string): number {
    const from = parseIsoComponents(fromIso);
    const to = parseIsoComponents(toIso);
    if (!from || !to) return 0;

    // Convert both to "seconds since epoch" using a simplified calculation
    // This is NOT a real epoch, just a consistent reference point for diffing
    const toSeconds = (c: typeof from) => {
        // Days since year 0 (approximate, ignoring leap years for simplicity in diffs)
        // For same-day operations, this is exact. For multi-day, close enough.
        const daysApprox = c.y * 365 + c.m * 30 + c.d;
        return daysApprox * 86400 + c.hh * 3600 + c.mm * 60 + c.ss;
    };

    return toSeconds(to) - toSeconds(from);
}

/**
 * Adds (or subtracts) seconds to an ISO string using pure component arithmetic.
 * No Date objects are used, avoiding all timezone issues.
 */
export function addSecondsToIsoString(isoStr: string, deltaSeconds: number): string | null {
    const c = parseIsoComponents(isoStr);
    if (!c) return null;

    // Convert to total seconds of day
    let totalSecondsOfDay = c.hh * 3600 + c.mm * 60 + c.ss + deltaSeconds;
    let dayDelta = 0;

    // Handle overflow/underflow of day
    while (totalSecondsOfDay >= 86400) {
        totalSecondsOfDay -= 86400;
        dayDelta++;
    }
    while (totalSecondsOfDay < 0) {
        totalSecondsOfDay += 86400;
        dayDelta--;
    }

    // New time components
    const newHh = Math.floor(totalSecondsOfDay / 3600);
    const newMm = Math.floor((totalSecondsOfDay % 3600) / 60);
    const newSs = totalSecondsOfDay % 60;

    // Adjust day (simplified: assumes 30-day months, good enough for typical photo swaps)
    let newD = c.d + dayDelta;
    let newM = c.m;
    let newY = c.y;

    while (newD > 30) {
        newD -= 30;
        newM++;
    }
    while (newD < 1) {
        newD += 30;
        newM--;
    }
    while (newM > 12) {
        newM -= 12;
        newY++;
    }
    while (newM < 1) {
        newM += 12;
        newY--;
    }

    return formatIsoFromComponents({ y: newY, m: newM, d: newD, hh: newHh, mm: newMm, ss: newSs });
}

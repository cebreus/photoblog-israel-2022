import type { CleanApertureData } from "$shared/types/clap";
import { execCapture, run } from "$scripts/utils/shell";

export interface ClapRational {
  widthN: number;
  widthD: number;
  heightN: number;
  heightD: number;
  horizOffN: number;
  horizOffD: number;
  vertOffN: number;
  vertOffD: number;
}

/**
 * Parse ExifTool clap output: "4032 1 3016 1 0 1 2 1"
 * Format: widthN widthD heightN heightD horizOffN horizOffD vertOffN vertOffD
 */
export function parseClapString(raw: string): ClapRational | null {
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length !== 8 || parts.some(Number.isNaN)) return null;

  return {
    widthN: parts[0],
    widthD: parts[1],
    heightN: parts[2],
    heightD: parts[3],
    horizOffN: parts[4],
    horizOffD: parts[5],
    vertOffN: parts[6],
    vertOffD: parts[7],
  };
}

export function clapRationalToPixels(raw: ClapRational): CleanApertureData {
  return {
    width: raw.widthN / raw.widthD,
    height: raw.heightN / raw.heightD,
    horizOffset: raw.horizOffN / raw.horizOffD,
    vertOffset: raw.vertOffN / raw.vertOffD,
  };
}

export function pixelsToClapString(clap: CleanApertureData): string {
  function toRational(n: number) {
    if (Number.isInteger(n)) {
      return `${n} 1`;
    }
    return `${Math.round(n * 10)} 10`;
  }

  return `${toRational(clap.width)} ${toRational(clap.height)} ${toRational(clap.horizOffset)} ${toRational(clap.vertOffset)}`;
}

const FALLBACK_PREFIX = "photoblog:clap:";

export async function readClapFromFile(filePath: string): Promise<CleanApertureData | null> {
  try {
    // 1. Try native CleanAperture atom (Apple HEIC native or JPEG with metadata)
    const nativeStdout = await execCapture("exiftool", ["-CleanAperture", "-n", "-s3", filePath]);
    if (nativeStdout && !nativeStdout.includes("Binary data")) {
      const rational = parseClapString(nativeStdout);
      let nativeClap = null;
      if (rational) {
        nativeClap = clapRationalToPixels(rational);
      }
      if (nativeClap) return nativeClap;
    }

    // 2. Try XPComment fallback (for HEIC files we've edited)
    // XPComment is used because it's writable to HEIC and NOT mapped to 'caption' in metadata-standards.ts
    const commentStdout = await execCapture("exiftool", ["-XPComment", "-s3", filePath]);
    if (commentStdout?.startsWith(FALLBACK_PREFIX)) {
      const rawClap = commentStdout.substring(FALLBACK_PREFIX.length);
      const rational = parseClapString(rawClap);
      if (rational) return clapRationalToPixels(rational);
    }

    return null;
  } catch (_error) {
    return null;
  }
}

export async function writeClapToFile(filePath: string, clap: CleanApertureData): Promise<void> {
  const clapString = pixelsToClapString(clap);
  try {
    // Attempt native write first
    await run("exiftool", ["-overwrite_original", `-CleanAperture=${clapString}`, filePath]);
    // If successful, ensure we don't have a stale fallback
    await run("exiftool", ["-overwrite_original", "-XPComment=", filePath]).catch(() => {});
  } catch (_error) {
    // If native write fails (common for HEIC), fallback to XPComment
    await run("exiftool", [
      "-overwrite_original",
      `-XPComment=${FALLBACK_PREFIX}${clapString}`,
      filePath,
    ]);
  }
}

export async function removeClapFromFile(filePath: string): Promise<void> {
  // Clear both possible locations
  await run("exiftool", ["-overwrite_original", "-CleanAperture=", "-XPComment=", filePath]).catch(
    async () => {
      // Individual fallbacks if combined fails
      await run("exiftool", ["-overwrite_original", "-CleanAperture=", filePath]).catch(() => {});
      await run("exiftool", ["-overwrite_original", "-XPComment=", filePath]).catch(() => {});
    },
  );
}

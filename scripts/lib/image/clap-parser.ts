import type { CleanApertureData } from "../../../shared/types/clap";
import { execCapture, run } from "../utils/shell";

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
  // Use denominator 1 for integer values, 10 for fractional
  const toRational = (n: number) => (Number.isInteger(n) ? `${n} 1` : `${Math.round(n * 10)} 10`);
  return `${toRational(clap.width)} ${toRational(clap.height)} ${toRational(clap.horizOffset)} ${toRational(clap.vertOffset)}`;
}

export async function readClapFromFile(filePath: string): Promise<CleanApertureData | null> {
  // -n for numeric output (rationals as "N D")
  // -s3 for very short output (value only)
  try {
    const stdout = await execCapture("exiftool", ["-CleanAperture", "-n", "-s3", filePath]);
    if (!stdout) return null;

    // Check if output is just binary data literal
    if (stdout.includes("Binary data")) return null;

    const rational = parseClapString(stdout);
    if (!rational) return null;

    return clapRationalToPixels(rational);
  } catch (_error) {
    // If tag doesn't exist or file error, start clean
    return null;
  }
}

export async function writeClapToFile(filePath: string, clap: CleanApertureData): Promise<void> {
  const clapString = pixelsToClapString(clap);
  // Using the combined tag is more reliable across different file formats (HEIC/JPEG)
  // as it avoids individual "not writable" errors for sub-tags.
  await run("exiftool", ["-overwrite_original", `-CleanAperture=${clapString}`, filePath]);
}

export async function removeClapFromFile(filePath: string): Promise<void> {
  await run("exiftool", ["-overwrite_original", "-CleanAperture=", filePath]);
}

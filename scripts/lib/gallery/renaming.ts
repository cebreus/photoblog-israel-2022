import { fileExists, rename, scanGlob, toSafeFilename } from "$scripts/utils/runtime";
import { SUPPORTED_INPUT_EXTENSIONS } from "$shared/types/images";
import { toPureWallClockISO } from "$shared/utils/dates";
import { toSlug } from "$shared/utils/strings";
import { type Tags, exiftool } from "exiftool-vendored";
import path from "node:path";

export type RenameMap = Map<string, RenameItem>;

export interface RenameItem {
  oldName: string;
  newName: string;
  oldPath: string;
  newPath: string;
  oldBase: string;
  newBase: string;
  oldRelPath: string;
  newRelPath: string;
}

export interface RenameResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

/**
 * Generates a new filename based on EXIF data and author logic.
 */
export function getNewBasename(
  tags: Tags,
  defaultAuthor: string,
  originalBasename: string = "",
  manifestAuthor?: string,
): string {
  // Extract suffix if present (e.g., "--collage", "--zoom1from2")
  let suffix = "";
  let basePart = originalBasename;
  const suffixMatch = originalBasename.match(/(--.+)$/);
  if (suffixMatch) {
    suffix = suffixMatch[1];
    basePart = originalBasename.slice(0, -suffix.length);
  }

  // Check if file is already in correct format: YYYY-MM-DD-HHMMSS-author
  // Pattern: 4 digits - 2 digits - 2 digits - 6 digits - author
  const alreadyRenamedPattern = /^\d{4}-\d{2}-\d{2}-\d{6}-[a-z0-9-]+$/i;
  if (alreadyRenamedPattern.test(basePart)) {
    // File is already renamed, return as-is with suffix
    return originalBasename;
  }

  let dateStr: string;
  const dateObj = tags.DateTimeOriginal || tags.CreateDate;

  if (!dateObj) {
    throw new Error("Missing creation date in EXIF data");
  }

  try {
    // Robustly handle Date objects vs strings vs ExifDateTime (which has .toDate())
    let isoDate: string | undefined;
    if (
      dateObj &&
      typeof dateObj === "object" &&
      "toDate" in (dateObj as unknown as Record<string, unknown>)
    ) {
      isoDate = toPureWallClockISO((dateObj as { toDate: () => Date | string }).toDate());
    } else {
      isoDate = toPureWallClockISO(dateObj as Date | string);
    }

    if (!isoDate) {
      throw new Error(`Invalid date format: ${dateObj}`);
    }

    // toPureWallClockISO returns YYYY-MM-DDTHH:mm:ss
    // We convert it to the filename format: YYYY-MM-DD-HHMMSS
    dateStr = isoDate.replace("T", "-").replace(/:/g, "");
  } catch (e) {
    throw new Error(`Failed to parse date: ${e instanceof Error ? e.message : String(e)}`);
  }

  let author = defaultAuthor;
  const metaAuthor = tags.Artist || tags.Creator || tags["By-line"] || tags.Author;

  if (metaAuthor) {
    if (Array.isArray(metaAuthor)) {
      author = metaAuthor[0];
    } else {
      author = String(metaAuthor);
    }
  } else if (manifestAuthor) {
    // Fallback 1: If no EXIF author, try the one from manifest
    author = manifestAuthor;
  } else if (!defaultAuthor && basePart && !basePart.match(/^\d{4}-\d{2}-\d{2}/)) {
    // Fallback 2: Use original basename if no default and no EXIF (and it's not already a processed name)
    author = basePart;
  }

  author = toSafeFilename(toSlug(author));

  // Build the new base name
  let newBase: string;
  if (!author) {
    newBase = dateStr;
  } else {
    newBase = `${dateStr}-${author}`;
  }

  // Re-append suffix if present
  if (!suffix) {
    return newBase;
  }
  return `${newBase}${suffix}`;
}

/**
 * Safe rename operation that returns status instead of throwing/swallowing.
 */
export async function safeRename(oldPath: string, newPath: string): Promise<RenameResult> {
  if (oldPath === newPath) return { success: true, skipped: true };
  try {
    await rename(oldPath, newPath);
    return { success: true };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "ENOENT") {
      return { success: false, error: "File not found (ENOENT)", skipped: true };
    }
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Analyzes a directory and builds a map of planned renames.
 */
export async function analyzeRenameCandidates(
  picsDir: string,
  defaultAuthor: string,
  imagesManifest?: import("$shared/types/manifest").Manifest,
): Promise<RenameMap> {
  const extensions = SUPPORTED_INPUT_EXTENSIONS.join(",");
  const files = await scanGlob(`**/*.{${extensions},${extensions.toUpperCase()}}`, {
    cwd: picsDir,
    absolute: true,
  });

  // Optimize lookup from manifest
  const manifestAuthors = new Map<string, string>();
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  if (imagesManifest?.photoDays) {
    for (const day of imagesManifest.photoDays) {
      for (const item of day.items) {
        if (item.type === "image" && item.author) {
          // Map src filename to author
          manifestAuthors.set(item.src, item.author);
          // Also map ID purely as base just in case
          manifestAuthors.set(item.id, item.author);

          // Extract and map UUID if present
          const match = item.id.match(uuidRegex);
          if (match) {
            manifestAuthors.set(match[0], item.author);
          }
        }
      }
    }
  }

  const renameMap: RenameMap = new Map();
  const usedNames = new Set<string>();

  for (const file of files) {
    const ext = path.extname(file);
    const oldName = path.basename(file);

    // We handle errors gracefully here to allow batch processing to continue
    // If EXIF fails, we just skip the file (warn logic should be in caller or logged here if we passed logger)
    let tags: Tags;
    try {
      tags = await exiftool.read(file);
    } catch {
      continue; // Skip files unreadable by exiftool
    }

    const oldBase = path.basename(oldName, ext);
    let baseNewName: string;

    // Check if we have an author in manifest for this file
    const manifestAuthor = manifestAuthors.get(oldName) || manifestAuthors.get(oldBase);

    try {
      baseNewName = getNewBasename(tags, defaultAuthor, oldBase, manifestAuthor);
    } catch {
      continue; // Skip files where basename generation fails (e.g. missing date)
    }

    let candidateName = `${baseNewName}${ext.toLowerCase()}`;

    let counter = 1;
    while (
      usedNames.has(candidateName) ||
      (candidateName !== oldName && (await fileExists(path.join(picsDir, candidateName))))
    ) {
      candidateName = `${baseNewName}-${counter}${ext.toLowerCase()}`;
      counter++;
    }

    usedNames.add(candidateName);

    if (candidateName === oldName) continue;

    renameMap.set(file, {
      oldName,
      newName: candidateName,
      oldPath: file,
      newPath: path.join(path.dirname(file), candidateName),
      oldBase: path.basename(oldName, path.extname(oldName)),
      newBase: path.basename(candidateName, path.extname(candidateName)),
      oldRelPath: path.relative(picsDir, file),
      newRelPath: path.join(path.dirname(path.relative(picsDir, file)), candidateName),
    });
  }

  return renameMap;
}

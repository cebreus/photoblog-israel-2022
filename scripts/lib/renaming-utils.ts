import fsp from "node:fs/promises"; // Bun's native fs/promises
import { toSlug } from "../../src/lib/utils/strings";
import { toSafeFilename } from "./path-utils";

export type RenameMap = Map<
  string,
  {
    oldName: string;
    newName: string;
    oldPath: string;
    newPath: string;
    oldBase: string;
    newBase: string;
    oldRelPath: string;
    newRelPath: string;
  }
>;

export function getNewBasename(
  tags: any,
  defaultAuthor: string,
  originalBasename: string = "",
): string {
  let dateStr: string;
  const dateObj = tags.DateTimeOriginal || tags.CreateDate;

  if (!dateObj) {
    throw new Error("Missing creation date in EXIF data");
  }

  try {
    const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj.toString());
    if (Number.isNaN(d.getTime())) {
      throw new Error("Invalid date format in EXIF data");
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const Min = String(d.getMinutes()).padStart(2, "0");
    const Sec = String(d.getSeconds()).padStart(2, "0");
    dateStr = `${yyyy}-${mm}-${dd}-${HH}${Min}${Sec}`;
  } catch (e) {
    throw new Error(`Failed to parse date: ${e instanceof Error ? e.message : String(e)}`);
  }

  let author = defaultAuthor;
  const metaAuthor = tags.Artist || tags.Creator || tags["By-line"] || tags.Author;
  if (metaAuthor) {
    author = Array.isArray(metaAuthor) ? metaAuthor[0] : String(metaAuthor);
  }
  author = toSafeFilename(toSlug(author));

  const safeOriginalBasename = toSafeFilename(originalBasename);

  if (!author) {
    return safeOriginalBasename ? `${dateStr}-${safeOriginalBasename}` : dateStr;
  }

  return safeOriginalBasename
    ? `${dateStr}-${author}-${safeOriginalBasename}`
    : `${dateStr}-${author}`;
}

export async function safeRename(oldPath: string, newPath: string) {
  if (oldPath === newPath) return;
  try {
    await fsp.rename(oldPath, newPath);
  } catch (e: any) {
    if (e.code === "ENOENT") {
    } else {
      throw e;
    }
  }
}

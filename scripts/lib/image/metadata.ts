import path from "node:path";
import { exiftool } from "exiftool-vendored";
import { toPureWallClockISO } from "../../../shared/utils/dates";
import { METADATA_STANDARDS } from "../../../shared/utils/metadata-standards";
import { isCollage, toSlug } from "../../../shared/utils/strings";
import type { ImageEntry, ExifData as ManifestExifData } from "../../../src/lib/types/manifest";
import { classifyMediaType, parseSequenceSuffix } from "./sequence-detector";
import { getAltText, getAspectRatioName, getKeywords, normalizeText } from "./utils";
export interface RawExifData extends ManifestExifData {
  ObjectName?: string;
  Headline?: string;
  Title?: string;
  "dc:title"?: string;
  ImageDescription?: string;
  Caption?: string;
  CaptionAbstract?: string;
  Byline?: string;
  "dc:creator"?: string | string[];
  Creator?: string;
  BylineTitle?: string;
  Artist?: string;
  Author?: string;
  Sublocation?: string;
  Orientation?: number | string;
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  ReleaseDate?: Date | string;
  Location?: string;
  City?: string;
  Copyright?: string;
  CopyrightNotice?: string;
  Category?: string;
  CategoryCode?: string;
  Country?: string;
  CountryCode?: string;
  State?: string;
  latitude?: number;
  longitude?: number;
  flags?: string[];
}

export async function cleanupMetadataTool(): Promise<void> {
  await exiftool.end();
}

export async function readRawMetadata(filePath: string): Promise<Record<string, unknown>> {
  return (await exiftool.read(filePath)) as unknown as Record<string, unknown>;
}

export function getStandardValue(
  exifTags: Record<string, unknown>,
  key: keyof typeof METADATA_STANDARDS,
): string | undefined {
  const config = METADATA_STANDARDS[key];
  for (const tag of config.read) {
    const val = exifTags[tag];
    if (val !== undefined && val !== null && val !== "") {
      if (Array.isArray(val)) {
        return val[0];
      }
      return String(val);
    }
  }
  return undefined;
}

export function getKeywordsList(exifTags: Record<string, unknown>): string[] | undefined {
  const config = METADATA_STANDARDS.keywords;
  for (const tag of config.read) {
    const val = exifTags[tag];
    if (val) {
      if (Array.isArray(val)) return val;
      return [String(val)];
    }
  }
  return undefined;
}

function getDateValue(exifTags: Record<string, unknown>, key: string): Date | string | undefined {
  const val = exifTags[key];
  // Prefer raw string value to avoid any timezone conversions
  if (val && typeof val === "object" && "rawValue" in val) {
    return (val as { rawValue: string }).rawValue;
  }
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  return val as Date | string | undefined;
}

const EXIF_MAPPING: Record<string, (tags: Record<string, unknown>) => unknown> = {
  ObjectName: function (tags) {
    return tags.ObjectName;
  },
  Headline: function (tags) {
    return tags.Headline;
  },
  Title: function (tags) {
    return getStandardValue(tags, "title");
  },
  "dc:title": function (tags) {
    return tags.Title;
  },
  ImageDescription: function (tags) {
    return tags.ImageDescription || tags.Description;
  },
  Caption: function (tags) {
    return getStandardValue(tags, "caption");
  },
  CaptionAbstract: function (tags) {
    return tags["Caption-Abstract"];
  },
  Byline: function (tags) {
    return tags["By-line"];
  },
  "dc:creator": function (tags) {
    return tags.Creator || tags["dc:creator"];
  },
  Creator: function (tags) {
    return getStandardValue(tags, "author");
  },
  BylineTitle: function (tags) {
    return tags["By-lineTitle"];
  },
  Artist: function (tags) {
    return tags.Artist;
  },
  Author: function (tags) {
    return getStandardValue(tags, "author");
  },
  Sublocation: function (tags) {
    return tags["Sub-location"];
  },
  Orientation: function (tags) {
    return tags.Orientation;
  },
  DateTimeOriginal: function (tags) {
    return getDateValue(tags, "DateTimeOriginal");
  },
  CreateDate: function (tags) {
    return getDateValue(tags, "CreateDate");
  },
  ReleaseDate: function (tags) {
    return (
      getDateValue(tags, "ReleaseDate") ||
      getDateValue(tags, "XMP:ReleaseDate") ||
      getDateValue(tags, "xmp:ReleaseDate")
    );
  },
  Location: function (tags) {
    return getStandardValue(tags, "location");
  },
  City: function (tags) {
    return getStandardValue(tags, "city");
  },
  Country: function (tags) {
    return getStandardValue(tags, "country");
  },
  CountryCode: function (tags) {
    return getStandardValue(tags, "countryCode");
  },
  State: function (tags) {
    return getStandardValue(tags, "state");
  },
  Copyright: function (tags) {
    return tags.Copyright;
  },
  CopyrightNotice: function (tags) {
    return tags.CopyrightNotice;
  },
  Category: function (tags) {
    return tags.Category;
  },
  latitude: function (tags) {
    return Number(tags.GPSLatitude) || undefined;
  },
  longitude: function (tags) {
    return Number(tags.GPSLongitude) || undefined;
  },
};

export function normalizeExifData(exifTags: Record<string, unknown>): Partial<RawExifData> {
  const exifRaw: Record<string, unknown> = {};

  for (const [key, mapper] of Object.entries(EXIF_MAPPING)) {
    exifRaw[key] = mapper(exifTags);
  }

  exifRaw.keywords = getKeywordsList(exifTags);

  const flagsFromExif = new Set<string>();

  // 1. Read from Label (XMP standard for status)
  const label = exifTags.Label;
  if (typeof label === "string" && label) {
    flagsFromExif.add(label);
  }

  // 2. Read from SupplementalCategories (IPTC standard for extra categories)
  const supp = exifTags.SupplementalCategories;
  if (Array.isArray(supp)) {
    for (const s of supp) {
      flagsFromExif.add(String(s));
    }
  } else if (typeof supp === "string" && supp) {
    flagsFromExif.add(supp);
  }

  if (flagsFromExif.size > 0) {
    exifRaw.flags = Array.from(flagsFromExif);
  }

  return exifRaw as Partial<RawExifData>;
}

function getCanonicalTitle(exif: Partial<RawExifData>): string | undefined {
  return normalizeText(exif.Title || exif.Headline || exif.ObjectName || exif["dc:title"]);
}

function getCanonicalCaption(exif: Partial<RawExifData>): string | undefined {
  return normalizeText(exif.Caption || exif.ImageDescription || exif.CaptionAbstract);
}

function getCanonicalAuthor(exif: Partial<RawExifData>): string | undefined {
  const authorRaw =
    exif.Byline ||
    (Array.isArray(exif["dc:creator"]) ? exif["dc:creator"][0] : exif["dc:creator"]) ||
    exif.Creator ||
    exif.BylineTitle ||
    exif.Artist ||
    exif.Author;

  return normalizeText(authorRaw);
}

// toPureWallClockISO is imported from shared utils

function getIsoDate(exif: Partial<RawExifData>): string | undefined {
  try {
    const d = exif.DateTimeOriginal || exif.CreateDate;
    if (d) return toPureWallClockISO(d);
  } catch {}
  return undefined;
}

function getReleaseDate(exif: Partial<RawExifData>): string | undefined {
  try {
    // Priority: ReleaseDate > DateTimeOriginal > CreateDate
    // BUT: If ReleaseDate is just a date (T00:00:00), prefer DateTimeOriginal if it has time.

    const releaseRaw = exif.ReleaseDate;
    const originRaw = exif.DateTimeOriginal || exif.CreateDate;

    if (releaseRaw) {
      const releaseISO = toPureWallClockISO(releaseRaw);
      if (releaseISO && !releaseISO.endsWith("T00:00:00")) {
        return releaseISO;
      }
      // ReleaseDate is midnight. Do we have a better origin?
      if (originRaw) {
        const originISO = toPureWallClockISO(originRaw);
        if (originISO && !originISO.endsWith("T00:00:00")) {
          return originISO;
        }
      }
      // Both are midnight or origin is missing, use release
      return releaseISO;
    }

    if (originRaw) return toPureWallClockISO(originRaw);
  } catch {}
  return undefined;
}

/**
 * Detect special media type based on filename and dimensions.
 */
function detectSpecialMedia(
  baseName: string,
  aspectRatioName: string | undefined,
): ImageEntry["specialMedia"] {
  const isCollageMedia = isCollage(baseName);

  if (isCollageMedia) {
    // Collages are flat images
    return undefined;
  }

  const seqInfo = parseSequenceSuffix(baseName);
  const isPanoSuffix = seqInfo?.type === "pano";
  const isSphereSuffix = baseName.includes("--sphere");

  if (isSphereSuffix) {
    return {
      isPanorama: true,
      is360: true,
      projection: "equirectangular",
      hfov: 360,
      vfov: 180,
    };
  }

  if (isPanoSuffix || aspectRatioName === "panorama") {
    return {
      isPanorama: true,
      is360: false,
      projection: "cylindrical",
      // Default to partial panorama unless we have more info
    };
  }

  return undefined;
}

export function buildImageEntry(
  baseName: string,
  absPath: string,
  exif: Partial<RawExifData>,
  originalMeta: { width?: number; height?: number },
  placeholderColor: string,
  sizeMB: number,
  analysis?: ImageEntry["analysis"],
  clap?: ImageEntry["clap"],
): ImageEntry {
  const title = getCanonicalTitle(exif) || "";
  const caption = getCanonicalCaption(exif);
  const author = getCanonicalAuthor(exif);
  const date = getIsoDate(exif);
  const releaseDate = getReleaseDate(exif);
  const id = toSlug(baseName);

  const aspectRatio = isCollage(baseName)
    ? "collage"
    : originalMeta.width && originalMeta.height
      ? getAspectRatioName(originalMeta.width, originalMeta.height)
      : undefined;

  return {
    id,
    type: classifyMediaType(baseName),
    src: path.basename(absPath),
    alt: getAltText(exif, caption, title),
    title,
    caption,
    width: originalMeta.width,
    height: originalMeta.height,
    sizeMB,
    aspectRatio: aspectRatio as ImageEntry["aspectRatio"], // Type cast needed due to "collage"
    placeholder: undefined,
    placeholderColor,
    specialMedia: detectSpecialMedia(baseName, aspectRatio),
    analysis: {
      aestheticScore: analysis?.aestheticScore,
      sharpness: analysis?.sharpness || 0,
      qualityBucket: analysis?.qualityBucket,
      phash: analysis?.phash || "",
      facesDetected: analysis?.facesDetected,
      faces: analysis?.faces,
    },
    clap,
    exif: {
      date: date || "",
      releaseDate: releaseDate || "",
      location: exif.Location,
      city: exif.City,
      latitude: exif.latitude,
      longitude: exif.longitude,
      // Collages are always correctly oriented (Sharp applies rotation during rendering)
      // so we ignore EXIF Orientation to prevent double-rotation in preview generation
      orientation: isCollage(baseName)
        ? undefined
        : typeof exif.Orientation === "number"
          ? exif.Orientation
          : undefined,
      copyright: normalizeText(exif.Copyright || exif.CopyrightNotice),
      category: normalizeText(exif.Category || exif.CategoryCode),
      country: exif.Country,
      countryCode: exif.CountryCode,
      state: exif.State,
    },
    author,
    authorSlug: author ? toSlug(author) : undefined,
    keywords: getKeywords(exif),
    location: exif.Sublocation || exif.Location,
    city: exif.City,
    googleMapsUrl:
      exif.latitude && exif.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${exif.latitude},${exif.longitude}`
        : undefined,
    date,
    sources: [],
    sequenceInfo: parseSequenceSuffix(baseName) || undefined,
    flags: (exif.flags?.length ?? 0) > 0 ? exif.flags : undefined,
  };
}

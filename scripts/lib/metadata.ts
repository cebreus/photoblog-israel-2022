import { exiftool } from "exiftool-vendored";
import path from "node:path";
import type { ImageEntry, ExifData as ManifestExifData } from "../../src/lib/types/manifest";
import { METADATA_STANDARDS } from "../../src/lib/utils/metadata-standards";
import { toSlug } from "../../src/lib/utils/strings";
import { getAltText, getAspectRatioName, getKeywords, normalizeText } from "./image-utils";
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

  return exifRaw as Partial<RawExifData>;
}

function getCanonicalTitle(exif: Partial<RawExifData>): string | undefined {
  return normalizeText(
    exif.ObjectName || exif.Headline || exif.Title || exif["dc:title"] || exif.ImageDescription,
  );
}

function getCanonicalCaption(exif: Partial<RawExifData>): string | undefined {
  return normalizeText(exif.Caption || exif.CaptionAbstract || exif.ImageDescription);
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

function getIsoDate(exif: Partial<RawExifData>): string | undefined {
  try {
    const d = exif.DateTimeOriginal || exif.CreateDate;
    if (d instanceof Date) return d.toISOString();
    if (typeof d === "string") return new Date(d).toISOString();
  } catch {}
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
): ImageEntry {
  const title = getCanonicalTitle(exif) || "";
  const caption = getCanonicalCaption(exif);
  const author = getCanonicalAuthor(exif);
  const date = getIsoDate(exif);

  return {
    id: toSlug(baseName),
    type: "image",
    src: path.basename(absPath),
    alt: getAltText(exif, caption, title),
    title,
    caption,
    width: originalMeta.width,
    height: originalMeta.height,
    sizeMB,
    aspectRatio:
      originalMeta.width && originalMeta.height
        ? getAspectRatioName(originalMeta.width, originalMeta.height)
        : undefined,
    placeholder: undefined,
    placeholderColor,
    analysis: {
      sharpness: analysis?.sharpness || 0,
      phash: analysis?.phash || "",
      embedding: analysis?.embedding || [],
      facesDetected: analysis?.facesDetected,
      faces: analysis?.faces,
    },
    exif: {
      date,
      location: exif.Location,
      city: exif.City,
      title: exif.Title || exif.ObjectName,
      sublocation: exif.Sublocation,
      latitude: exif.latitude,
      longitude: exif.longitude,
      orientation: typeof exif.Orientation === "number" ? exif.Orientation : undefined,
      description: normalizeText(exif.ImageDescription || undefined),
      keywords: getKeywords(exif),
      author,
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
  };
}

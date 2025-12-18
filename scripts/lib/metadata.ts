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

export async function readRawMetadata(filePath: string): Promise<any> {
  return exiftool.read(filePath);
}

export function getStandardValue(
  exifTags: any,
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

export function getKeywordsList(exifTags: any): string[] | undefined {
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

export function normalizeExifData(exifTags: any): Partial<RawExifData> {
  const exifRaw: Partial<RawExifData> = {
    ObjectName: exifTags.ObjectName,
    Headline: exifTags.Headline,
    Title: getStandardValue(exifTags, "title"),
    "dc:title": exifTags.Title,
    ImageDescription: exifTags.ImageDescription || exifTags.Description,
    Caption: getStandardValue(exifTags, "caption"),
    CaptionAbstract: exifTags["Caption-Abstract"],
    Byline: exifTags["By-line"],
    "dc:creator": exifTags.Creator || exifTags["dc:creator"],
    Creator: getStandardValue(exifTags, "author"),
    BylineTitle: exifTags["By-lineTitle"],
    Artist: exifTags.Artist,
    Author: getStandardValue(exifTags, "author"),
    Sublocation: exifTags["Sub-location"] as string,
    Orientation: exifTags.Orientation,
    DateTimeOriginal:
      typeof exifTags.DateTimeOriginal === "object"
        ? exifTags.DateTimeOriginal.toDate()
        : (exifTags.DateTimeOriginal as any),
    CreateDate:
      typeof exifTags.CreateDate === "object"
        ? exifTags.CreateDate.toDate()
        : (exifTags.CreateDate as any),
    Location: getStandardValue(exifTags, "location"),
    City: getStandardValue(exifTags, "city"),
    Country: getStandardValue(exifTags, "country"),
    CountryCode: getStandardValue(exifTags, "countryCode"),
    State: getStandardValue(exifTags, "state"),
    Copyright: exifTags.Copyright,
    CopyrightNotice: exifTags.CopyrightNotice,
    Category: exifTags.Category,
    latitude: Number(exifTags.GPSLatitude) || undefined,
    longitude: Number(exifTags.GPSLongitude) || undefined,
  };

  (exifRaw as any).keywords = getKeywordsList(exifTags);

  return exifRaw;
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
  analysis?: { sharpness: number; phash: string; embedding: number[] },
): ImageEntry {
  const titleCanonical = getCanonicalTitle(exif);
  const captionCanonical = getCanonicalCaption(exif);
  const authorCanonical = getCanonicalAuthor(exif);
  const isoDate = getIsoDate(exif);

  const googleMapsUrl =
    exif.latitude && exif.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${exif.latitude},${exif.longitude}`
      : undefined;

  return {
    id: toSlug(baseName),
    type: "image",
    src: path.basename(absPath),
    alt: getAltText(exif, captionCanonical, titleCanonical),
    title: titleCanonical || "",
    caption: captionCanonical,
    width: originalMeta.width,
    height: originalMeta.height,
    sizeMB,
    aspectRatio:
      originalMeta.width && originalMeta.height
        ? getAspectRatioName(originalMeta.width, originalMeta.height)
        : undefined,
    placeholder: undefined, // Filled later
    placeholderColor,
    analysis: {
      sharpness: analysis?.sharpness || 0,
      phash: analysis?.phash || "",
      embedding: analysis?.embedding || [],
    },
    exif: {
      date: isoDate,
      location: exif.Location,
      city: exif.City,
      title: exif.Title || exif.ObjectName,
      sublocation: exif.Sublocation,
      latitude: exif.latitude,
      longitude: exif.longitude,
      orientation: exif.Orientation as any,
      description: normalizeText(exif.ImageDescription || undefined),
      keywords: getKeywords(exif),
      author: authorCanonical,
      copyright: normalizeText(exif.Copyright || exif.CopyrightNotice),
      category: normalizeText(exif.Category || exif.CategoryCode),
      country: exif.Country,
      countryCode: exif.CountryCode,
      state: exif.State,
    },
    author: authorCanonical,
    authorSlug: authorCanonical ? toSlug(authorCanonical) : undefined,
    keywords: getKeywords(exif),
    location: exif.Sublocation || exif.Location,
    city: exif.City,
    googleMapsUrl,
    date: isoDate,
    sources: [],
  };
}

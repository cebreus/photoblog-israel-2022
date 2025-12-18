export interface MetadataFieldConfig {
  label: string;
  // Tags to read from, in order of priority (e.g. ['XMP:Title', 'IPTC:ObjectName'])
  read: string[];
  // Tags to write to. All of them should be updated to maintain consistency.
  write: string[];
}

export type MetadataKey =
  | "title"
  | "caption"
  | "keywords"
  | "author"
  | "location"
  | "city"
  | "state"
  | "country"
  | "countryCode";

export const METADATA_STANDARDS: Record<MetadataKey, MetadataFieldConfig> = {
  title: {
    label: "Název",
    read: ["Title", "ObjectName", "ImageDescription"],
    write: ["XMP:Title", "IPTC:ObjectName", "Exif:ImageDescription"],
  },
  caption: {
    label: "Popisek",
    read: ["Description", "Caption-Abstract", "UserComment"],
    write: ["XMP:Description", "IPTC:Caption-Abstract"],
  },
  keywords: {
    label: "Klíčová slova",
    read: ["Subject", "Keywords"],
    write: ["XMP:Subject", "IPTC:Keywords"],
  },
  author: {
    label: "Autor",
    read: ["Creator", "By-line", "Artist", "dc:creator"],
    write: ["XMP:Creator", "IPTC:By-line", "IFD0:Artist"],
    // Exif:Artist is often read-only or camera-specific, but IFD0:Artist is usually writable.
  },
  location: {
    label: "Místo",
    read: ["Location", "Sub-location"],
    write: ["XMP:Location", "IPTC:Sub-location"],
  },
  city: {
    label: "Město",
    read: ["City"],
    write: ["XMP:City", "IPTC:City"],
  },
  state: {
    label: "Stát/Provincie",
    read: ["State", "Province-State"],
    write: ["XMP:State", "IPTC:Province-State"],
  },
  country: {
    label: "Země",
    read: ["Country", "Country-PrimaryLocationName"],
    write: ["XMP:Country", "IPTC:Country-PrimaryLocationName"],
  },
  countryCode: {
    label: "Kód země",
    read: ["CountryCode", "Country-PrimaryLocationCode"],
    write: ["XMP:CountryCode", "IPTC:Country-PrimaryLocationCode"],
  },
};

/**
 * Returns a record of tags to write for a given set of canonical updates.
 * Updates are applied to all defined 'write' targets for each key.
 */
export function getExifToolWriteTags(
  updates: Partial<Record<MetadataKey, string | string[] | null>>,
): Record<string, string | string[] | null> {
  const tags: Record<string, string | string[] | null> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const config = METADATA_STANDARDS[key as MetadataKey];
    if (!config) continue;

    for (const tag of config.write) {
      tags[tag] = value;
    }
  }

  // Always enforce UTF-8 for IPTC to prevent Mojibake
  tags["IPTC:CodedCharacterSet"] = "UTF8";

  return tags;
}

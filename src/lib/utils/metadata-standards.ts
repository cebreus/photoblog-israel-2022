export interface MetadataFieldConfig {
  label: string;
  read: string[];
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
    read: ["Title", "ObjectName", "XMP:Title"],
    // Breaking change: Title no longer writes to Exif:ImageDescription (moved to caption field)
    write: ["XMP:Title", "IPTC:ObjectName"],
  },
  caption: {
    label: "Popisek",
    read: ["Description", "Caption-Abstract", "ImageDescription", "UserComment"],
    // Breaking change: Caption now writes to Exif:ImageDescription (previously only title wrote here)
    write: ["XMP:Description", "IPTC:Caption-Abstract", "Exif:ImageDescription"],
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

  if (Object.keys(tags).length > 0) {
    tags["IPTC:CodedCharacterSet"] = "UTF8";
  }

  return tags;
}

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { exiftool } from "exiftool-vendored";
import { getExifToolWriteTags } from "../../src/lib/metadata-standards";
import { createImageEntry } from "../../scripts/lib/image-processor";
import { getKeywords } from "../../scripts/lib/image-utils";
import { buildInputSet } from "../utils/fixtures";
import sharp from "sharp";

import { config } from "../../scripts/config";

const CWD = path.resolve(__dirname, "../../");

function getTmpDir(prefix: string) {
  const tmpRoot = path.join(CWD, config.paths.tmp, "integration");
  if (!fs.existsSync(tmpRoot)) {
    fs.mkdirSync(tmpRoot, { recursive: true });
  }
  return fs.mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

describe("Metadata Roundtrip Integration", () => {
  let tmpDir: string;
  let imgPath: string;

  beforeAll(async () => {
    tmpDir = getTmpDir("meta-test");
    await buildInputSet(tmpDir);
    // Use the portrait jpeg as our test subject
    imgPath = path.join(tmpDir, "portrait.jpeg");
  });

  afterAll(async () => {
    // Ensure ExifTool is closed
    await exiftool.end();
  });

  it("writes and reads metadata with diacritics correctly (UTF-8) for ALL fields", async () => {
    // We test EVERY field defined in generic Metadata Standards to ensure full coverage
    const updates = {
      author: "Ondřej Ďábel",
      title: "Příliš žluťoučký kůň",
      caption: "Úpění ďábelské ódy",
      keywords: ["čeština", "žluťoučký", "test"],
      city: "České Budějovice",
      // New fields for 100% coverage
      location: "Náměstí Přemysla Otakara II.",
      state: "Jihočeský kraj",
      country: "Česká republika",
      countryCode: "CZE", // Standard ISO code is ASCII, but good to check mapping
    };

    // 1. Generate write tags using standards
    const writeTags = getExifToolWriteTags(updates);
    // console.log("Write Tags:", writeTags);

    // 2. Perform Write (simulating API behavior)
    // Critical: -charset iptc=UTF8 is required for IPTC to handle these chars
    await exiftool.write(imgPath, writeTags, [
      "-overwrite_original",
      "-charset",
      "iptc=UTF8",
    ]);

    // 3. Perform Read (simulating Image Processor behavior)
    // Note: exiftool-vendored handles tag reading.
    const rawTags = await exiftool.read(imgPath);

    // 4. Convert to canonical entry
    // We mock sharp metadata as it's not relevant for metadata text
    const mockMeta = { width: 600, height: 900 } as any;

    // Simulate the mapping done in processImage
    const mappedExif = {
      ...rawTags,
      CaptionAbstract: rawTags["Caption-Abstract"],
      Byline: rawTags["By-line"],
      // Convert ExifDateTime to Date for RawExifData compatibility
      DateTimeOriginal:
        rawTags.DateTimeOriginal &&
        typeof rawTags.DateTimeOriginal === "object" &&
        "toDate" in rawTags.DateTimeOriginal
          ? (rawTags.DateTimeOriginal as any).toDate()
          : rawTags.DateTimeOriginal,
    };

    const entry = await createImageEntry(
      "portrait",
      imgPath,
      mappedExif as any,
      mockMeta,
      "#000000",
    );

    // 5. Assert Canonical Read (what frontend sees)
    expect(entry.author).toBe(updates.author);
    expect(entry.title).toBe(updates.title);
    expect(entry.caption).toBe(updates.caption);
    expect(entry.city).toBe(updates.city);
    expect(entry.location).toBe(updates.location);
    // State/Country are inside exif object in ImageEntry
    expect(entry.exif?.state).toBe(updates.state);
    expect(entry.exif?.country).toBe(updates.country);
    expect(entry.exif?.countryCode).toBe(updates.countryCode);

    // Verify keywords at top level (newly exposed)
    expect(entry.keywords).toEqual(expect.arrayContaining(updates.keywords));

    // 6. Assert Raw Tag Structure (what file contains)
    // Check canonical fields returned by ExifTool (which maps XMP:Creator to Creator)
    expect(rawTags.Creator).toBe(updates.author);
    expect(rawTags.City).toBe(updates.city);
    expect(rawTags.State).toBe(updates.state);
    expect(rawTags.Country).toBe(updates.country);

    // iptc-vendored maps By-line to 'By-line'
    expect(rawTags["By-line"]).toBe(updates.author);
  });
});

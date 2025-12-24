/**
 * @fileoverview Metadata Roundtrip Integration Tests
 *
 * @description
 * Tests the metadata reading and writing capabilities using `exiftool-vendored`.
 * Verifies that UTF-8 characters (diacritics) and standard metadata fields (IPTC/XMP)
 * are correctly preserved through a write -> read cycle.
 *
 * @modules-tested
 * - scripts/lib/metadata.ts
 * - src/lib/utils/metadata-standards.ts
 */

import fs from "node:fs";
import path from "node:path";
import { exiftool } from "exiftool-vendored";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../../scripts/build.config";
import { buildImageEntry, type RawExifData } from "../../scripts/lib/image/metadata";
import { getExifToolWriteTags } from "../../src/lib/utils/metadata-standards";
import { buildInputSet } from "../utils/fixtures";

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

    // 2. Perform Write (simulating API behavior)
    // Critical: -charset iptc=UTF8 is required for IPTC to handle these chars
    await exiftool.write(imgPath, writeTags, ["-overwrite_original", "-charset", "iptc=UTF8"]);

    // 3. Perform Read (simulating Image Processor behavior)
    // Note: exiftool-vendored handles tag reading.
    const rawTags = await exiftool.read(imgPath);

    // 4. Convert to canonical entry
    // We mock sharp metadata as it's not relevant for metadata text
    const mockMeta: { width?: number; height?: number } = { width: 600, height: 900 };

    // Simulate the mapping done in processImage
    const mappedExif: Partial<RawExifData> = {
      ...rawTags,
      CaptionAbstract: rawTags["Caption-Abstract"] as string | undefined,
      Byline: rawTags["By-line"] as string | undefined,
      // Convert ExifDateTime to Date for RawExifData compatibility
      DateTimeOriginal:
        rawTags.DateTimeOriginal &&
        typeof rawTags.DateTimeOriginal === "object" &&
        "toDate" in rawTags.DateTimeOriginal
          ? (rawTags.DateTimeOriginal as { toDate: () => Date })
              .toDate()
              .toISOString() // Wait, RawExifData has Date | string
          : (rawTags.DateTimeOriginal as string | undefined),
    } as unknown as Partial<RawExifData>;

    // Fix DateTimeOriginal type for buildImageEntry if needed.
    // RawExifData definition has `DateTimeOriginal?: Date | string;`
    // exiftool read returns ExifDateTime which has .toDate().

    const entry = buildImageEntry(
      "portrait",
      imgPath,
      mappedExif,
      mockMeta,
      "#000000",
      0, // Dummy sizeMB
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
